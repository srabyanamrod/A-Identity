// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentSpendPolicy
/// @notice An on-chain spending policy for an AI agent's USDC wallet on Arc.
///
/// The vault holds USDC and enforces the agent's spend policy at the contract
/// level — not on a server. The agent (the `operator`) can only move funds
/// within the rules; anything outside them reverts on-chain, verifiably, on the
/// Arc explorer. The human `owner` sets the policy, can settle an above-ceiling
/// payment they approved off-chain, can freeze all agent spending, and can
/// withdraw.
///
/// Rules enforced by `pay`:
///   - `frozen`            — when true, the agent cannot spend at all
///   - `allowlistEnabled`  — when true, the payee must be on the allowlist
///   - `autoApproveMax`    — a single agent payment above this is rejected (0 = no ceiling)
///   - `dailyCap`          — cumulative agent spend per UTC day is capped (0 = no cap)
///
/// All amounts are in USDC's 6-decimal ERC-20 units (e.g. $1.00 = 1_000_000),
/// matching the `payUsdcOnchain` convention in the backend. USDC on Arc is the
/// token at 0x3600...0000, exposed here through the standard ERC-20 interface.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract AgentSpendPolicy {
    /// @notice Human principal — sets policy, settles overrides, freezes, withdraws.
    address public owner;
    /// @notice The agent's signer — may call `pay` within the policy.
    address public operator;
    /// @notice The USDC token (6-decimal ERC-20 interface).
    IERC20 public immutable usdc;

    /// @notice Max cumulative agent spend per UTC day, in 6-decimal units. 0 = unlimited.
    uint256 public dailyCap;
    /// @notice Max size of a single agent payment, in 6-decimal units. 0 = no ceiling.
    uint256 public autoApproveMax;
    /// @notice When true, the agent cannot spend (owner override still works).
    bool public frozen;
    /// @notice When true, `pay` requires the payee to be on the allowlist.
    bool public allowlistEnabled;

    /// @notice UTC-day index => units spent by the agent that day.
    mapping(uint256 => uint256) public spentOnDay;
    /// @notice Payee => allowed (only consulted when `allowlistEnabled`).
    mapping(address => bool) public allowed;

    event Paid(address indexed to, uint256 amount, uint256 indexed dayIndex, bool byOwner);
    event PolicyUpdated(uint256 dailyCap, uint256 autoApproveMax, bool allowlistEnabled);
    event FrozenSet(bool frozen);
    event AllowlistSet(address indexed payee, bool allowed);
    event OperatorSet(address indexed operator);
    event Withdrawn(address indexed to, uint256 amount);

    error NotOwner();
    error NotOperator();
    error IsFrozen();
    error PayeeNotAllowed();
    error AboveAutoApprove();
    error DailyCapExceeded();
    error ZeroAddress();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(
        address _owner,
        address _operator,
        address _usdc,
        uint256 _dailyCap,
        uint256 _autoApproveMax
    ) {
        if (_owner == address(0) || _usdc == address(0)) revert ZeroAddress();
        owner = _owner;
        operator = _operator;
        usdc = IERC20(_usdc);
        dailyCap = _dailyCap;
        autoApproveMax = _autoApproveMax;
    }

    /// @notice Current UTC-day index (chain time). Rolls over at 00:00 UTC.
    function today() public view returns (uint256) {
        return block.timestamp / 86400;
    }

    /// @notice Units the agent has spent so far in the current UTC day.
    function spentToday() external view returns (uint256) {
        return spentOnDay[today()];
    }

    /// @notice USDC held by the vault (the agent's spendable balance).
    function balance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice Agent-initiated payment. Enforced by the policy; reverts (with a
    /// typed error the caller can decode) if any gate fails. The revert reason is
    /// exactly why the human-in-the-loop path should take over.
    function pay(address to, uint256 amount) external onlyOperator {
        if (to == address(0)) revert ZeroAddress();
        if (frozen) revert IsFrozen();
        if (allowlistEnabled && !allowed[to]) revert PayeeNotAllowed();
        if (autoApproveMax != 0 && amount > autoApproveMax) revert AboveAutoApprove();
        uint256 d = today();
        if (dailyCap != 0 && spentOnDay[d] + amount > dailyCap) revert DailyCapExceeded();
        spentOnDay[d] += amount;
        if (!usdc.transfer(to, amount)) revert TransferFailed();
        emit Paid(to, amount, d, false);
    }

    /// @notice Owner settles a payment approved off-chain by a human. Bypasses the
    /// auto-approve ceiling, the allowlist, and the freeze (it is a human act), but
    /// still counts toward the daily cap so on-chain accounting stays honest.
    function ownerPay(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 d = today();
        spentOnDay[d] += amount;
        if (!usdc.transfer(to, amount)) revert TransferFailed();
        emit Paid(to, amount, d, true);
    }

    // ── owner policy controls ─────────────────────────────────────────────────

    function setPolicy(uint256 _dailyCap, uint256 _autoApproveMax, bool _allowlistEnabled) external onlyOwner {
        dailyCap = _dailyCap;
        autoApproveMax = _autoApproveMax;
        allowlistEnabled = _allowlistEnabled;
        emit PolicyUpdated(_dailyCap, _autoApproveMax, _allowlistEnabled);
    }

    function setAllowed(address payee, bool ok) external onlyOwner {
        allowed[payee] = ok;
        emit AllowlistSet(payee, ok);
    }

    function setOperator(address _operator) external onlyOwner {
        operator = _operator;
        emit OperatorSet(_operator);
    }

    function setFrozen(bool _frozen) external onlyOwner {
        frozen = _frozen;
        emit FrozenSet(_frozen);
    }

    /// @notice Withdraw USDC from the vault back to the owner (or anywhere).
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (!usdc.transfer(to, amount)) revert TransferFailed();
        emit Withdrawn(to, amount);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract OpenDEX is EIP712, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Order {
        address trader;
        bool isBuy;
        uint256 price;
        uint256 amount;
        uint256 nonce;
        uint256 expiry;
    }

    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order (address trader, bool isBuy, uint256 price,uint256 amount,uint256 nonce,uint256 expiry)"
    );
    uint256 public constant PRICE_SCALE = 1e18;

    IERC20 public immutable baseToken;
    IERC20 public immutable quoteToken;
    address public operator;
    
    mapping(bytes32 => uint256) public filled;
    mapping(bytes32 => bool) public cancelled;

    event Trade(
        bytes32 indexed buyHash,
        bytes32 indexed sellHash,
        address indexed buyer,
        address seller,
        uint256 price,
        uint256 amount,
        uint256 quoteAmount
    );
    event OrderCancelled(bytes32 indexed orderHash, address indexed trader);
    event OperatorChanged(address indexed operator);

    error NotOperator();
    error NotTrader();
    error InvalidSide();
    error SameTrader();
    error ZeroAmount();
    error PriceOutOfRange();
    error OrderExpired();
    error InvalidSignature();
    error OrderIsCancelled();
    error Overfill();

    constructor(IERC20 baseToken_, IERC20 quoteToken_, address operator_)
        EIP712("OpenDEX", "1")
        Ownable(msg.sender)
    {
        baseToken = baseToken_;
        quoteToken = quoteToken_;
        operator = operator_;
    }

    function setOperator(address operator_) external onlyOwner {
        operator = operator_;
        emit OperatorChanged(operator_);
    }

    function hashOrder(Order memory o) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(ORDER_TYPEHASH, o.trader, o.isBuy, o.price, o.amount, o.nonce, o.expiry)
            )
        );
    }

    function settle(
        Order calldata buy,
        bytes calldata buySig,
        Order calldata sell,
        bytes calldata sellSig,
        uint256 fillAmount,
        uint256 tradePrice
    ) external nonReentrant {
        if (msg.sender != operator) revert NotOperator();
        if (!buy.isBuy || sell.isBuy) revert InvalidSide();
        if (buy.trader == sell.trader) revert SameTrader();
        if (fillAmount == 0) revert ZeroAmount();
        if (tradePrice > buy.price || tradePrice < sell.price) revert PriceOutOfRange();

        bytes32 buyHash = _verify(buy, buySig, fillAmount);
        bytes32 sellHash = _verify(sell, sellSig, fillAmount);

        filled[buyHash] += fillAmount;
        filled[sellHash] += fillAmount;

        uint256 quoteAmount = (fillAmount * tradePrice) / PRICE_SCALE;
        if (quoteAmount == 0) revert ZeroAmount();

        baseToken.safeTransferFrom(sell.trader, buy.trader, fillAmount);
        quoteToken.safeTransferFrom(buy.trader, sell.trader, quoteAmount);

        emit Trade(buyHash, sellHash, buy.trader, sell.trader, tradePrice, fillAmount, quoteAmount);
    }

    function cancel(Order calldata o) external {
        if (msg.sender != o.trader) revert NotTrader();
        bytes32 h = hashOrder(o);
        cancelled[h] = true;
        emit OrderCancelled(h, o.trader);
    }

    function _verify(Order calldata o, bytes calldata sig, uint256 fillAmount)
        internal
        view
        returns (bytes32 h)
    {
        if (block.timestamp > o.expiry) revert OrderExpired();
        h = hashOrder(o);
        if (ECDSA.recover(h, sig) != o.trader) revert InvalidSignature();
        if (cancelled[h]) revert OrderIsCancelled();
        if (filled[h] + fillAmount > o.amount) revert Overfill();
    }
}

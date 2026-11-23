// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TestToken} from "../src/TestToken.sol";
import {OpenDEX} from "../src/OpenDEX.sol";

contract OpenDEXTest is Test {
    TestToken gold;
    TestToken usdx;
    OpenDEX dex;

    uint256 buyerPk = 0xB0B;
    uint256 sellerPk = 0xA11CE;
    address buyer;
    address seller;
    address operator = makeAddr("operator");
    uint256 constant ONE = 1 ether;

    function setUp() public {
        buyer = vm.addr(buyerPk);
        seller = vm.addr(sellerPk);
        gold = new TestToken("Gold", "GOLD");
        usdx = new TestToken("USD Experimental", "USDx");
        dex = new OpenDEX(IERC20(address(gold)), IERC20(address(usdx)), operator);
        gold.transfer(seller, 100 * ONE);
        usdx.transfer(buyer, 1000 * ONE);
        vm.prank(seller);
        gold.approve(address(dex), type(uint256).max);
        vm.prank(buyer);
        usdx.approve(address(dex), type(uint256).max);
    }

    function _order(address trader, bool isBuy, uint256 price, uint256 amount, uint256 nonce)
        internal
        view
        returns (OpenDEX.Order memory)
    {
        return OpenDEX.Order(trader, isBuy, price, amount, nonce, block.timestamp + 1 days);
    }

    function _sign(uint256 pk, OpenDEX.Order memory o) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, dex.hashOrder(o));
        return abi.encodePacked(r, s, v);
    }

    function _sigs(OpenDEX.Order memory b, OpenDEX.Order memory s)
        internal
        view
        returns (bytes memory, bytes memory)
    {
        return (_sign(buyerPk, b), _sign(sellerPk, s));
    }

    function _settle(OpenDEX.Order memory b, OpenDEX.Order memory s, uint256 fill, uint256 price) internal {
        (bytes memory bs, bytes memory ss) = _sigs(b, s);
        vm.prank(operator);
        dex.settle(b, bs, s, ss, fill, price);
    }

    function test_FullFill() public {
        OpenDEX.Order memory b = _order(buyer, true, 2 * ONE, 10 * ONE, 1);
        OpenDEX.Order memory s = _order(seller, false, 2 * ONE, 10 * ONE, 1);
        _settle(b, s, 10 * ONE, 2 * ONE);
        assertEq(gold.balanceOf(buyer), 10 * ONE);
        assertEq(gold.balanceOf(seller), 90 * ONE);
        assertEq(usdx.balanceOf(seller), 20 * ONE);
        assertEq(usdx.balanceOf(buyer), 980 * ONE);
        assertEq(dex.filled(dex.hashOrder(b)), 10 * ONE);
        assertEq(dex.filled(dex.hashOrder(s)), 10 * ONE);
    }

    function test_TradesAtRestingOrderPrice() public {
        OpenDEX.Order memory b = _order(buyer, true, 3 * ONE, 10 * ONE, 1);
        OpenDEX.Order memory s = _order(seller, false, 2 * ONE, 10 * ONE, 1);
        _settle(b, s, 10 * ONE, 2 * ONE);
        assertEq(usdx.balanceOf(buyer), 980 * ONE);
        assertEq(usdx.balanceOf(seller), 20 * ONE);
    }

    function test_PartialFillThenComplete() public {
        OpenDEX.Order memory b = _order(buyer, true, 2 * ONE, 10 * ONE, 1);
        OpenDEX.Order memory s1 = _order(seller, false, 2 * ONE, 4 * ONE, 1);
        OpenDEX.Order memory s2 = _order(seller, false, 2 * ONE, 6 * ONE, 2);
        OpenDEX.Order memory s3 = _order(seller, false, 2 * ONE, 1 * ONE, 3);

        _settle(b, s1, 4 * ONE, 2 * ONE);
        assertEq(dex.filled(dex.hashOrder(b)), 4 * ONE);
        assertEq(gold.balanceOf(buyer), 4 * ONE);

        _settle(b, s2, 6 * ONE, 2 * ONE);
        assertEq(dex.filled(dex.hashOrder(b)), 10 * ONE);
        assertEq(gold.balanceOf(buyer), 10 * ONE);

        (bytes memory bs, bytes memory ss) = _sigs(b, s3);
        vm.expectRevert(OpenDEX.Overfill.selector);
        vm.prank(operator);
        dex.settle(b, bs, s3, ss, 1 * ONE, 2 * ONE);
    }

    function test_RevertWhen_PriceNotCrossed() public {
        OpenDEX.Order memory b = _order(buyer, true, 1 * ONE, 10 * ONE, 1);
        OpenDEX.Order memory s = _order(seller, false, 2 * ONE, 10 * ONE, 1);
        (bytes memory bs, bytes memory ss) = _sigs(b, s);
        vm.expectRevert(OpenDEX.PriceOutOfRange.selector);
        vm.prank(operator);
        dex.settle(b, bs, s, ss, 10 * ONE, 1 * ONE);
    }

    function test_RevertWhen_Replay() public {
        OpenDEX.Order memory b = _order(buyer, true, 2 * ONE, 10 * ONE, 1);
        OpenDEX.Order memory s = _order(seller, false, 2 * ONE, 10 * ONE, 1);
        _settle(b, s, 10 * ONE, 2 * ONE);
        (bytes memory bs, bytes memory ss) = _sigs(b, s);
        vm.expectRevert(OpenDEX.Overfill.selector);
        vm.prank(operator);
        dex.settle(b, bs, s, ss, 10 * ONE, 2 * ONE);
    }

    function test_CancelBlocksSettlement() public {
        OpenDEX.Order memory b = _order(buyer, true, 2 * ONE, 10 * ONE, 1);
        OpenDEX.Order memory s = _order(seller, false, 2 * ONE, 10 * ONE, 1);
        vm.prank(buyer);
        dex.cancel(b);
        assertTrue(dex.cancelled(dex.hashOrder(b)));
        (bytes memory bs, bytes memory ss) = _sigs(b, s);
        vm.expectRevert(OpenDEX.OrderIsCancelled.selector);
        vm.prank(operator);
        dex.settle(b, bs, s, ss, 10 * ONE, 2 * ONE);
    }

    function test_RevertWhen_CancelByStranger() public {
        OpenDEX.Order memory b = _order(buyer, true, 2 * ONE, 10 * ONE, 1);
        vm.expectRevert(OpenDEX.NotTrader.selector);
        vm.prank(seller);
        dex.cancel(b);
    }

    function test_RevertWhen_InsufficientBalance() public {
        OpenDEX.Order memory b = _order(buyer, true, 2 * ONE, 10 * ONE, 1);
        OpenDEX.Order memory s = _order(seller, false, 2 * ONE, 10 * ONE, 1);
        vm.prank(buyer);
        usdx.transfer(address(0xdead), 1000 * ONE);
        (bytes memory bs, bytes memory ss) = _sigs(b, s);
        vm.expectRevert();
        vm.prank(operator);
        dex.settle(b, bs, s, ss, 10 * ONE, 2 * ONE);
        assertEq(gold.balanceOf(seller), 100 * ONE);
    }

    function test_RevertWhen_InsufficientAllowance() public {
        OpenDEX.Order memory b = _order(buyer, true, 2 * ONE, 10 * ONE, 1);
        OpenDEX.Order memory s = _order(seller, false, 2 * ONE, 10 * ONE, 1);
        vm.prank(buyer);
        usdx.approve(address(dex), 0);
        (bytes memory bs, bytes memory ss) = _sigs(b, s);
        vm.expectRevert();
        vm.prank(operator);
        dex.settle(b, bs, s, ss, 10 * ONE, 2 * ONE);
        assertEq(gold.balanceOf(seller), 100 * ONE);
    }

    function test_RevertWhen_BadSignature() public {
        OpenDEX.Order memory b = _order(buyer, true, 2 * ONE, 10 * ONE, 1);
        OpenDEX.Order memory s = _order(seller, false, 2 * ONE, 10 * ONE, 1);
        bytes memory forged = _sign(sellerPk, b);
        bytes memory ss = _sign(sellerPk, s);
        vm.expectRevert(OpenDEX.InvalidSignature.selector);
        vm.prank(operator);
        dex.settle(b, forged, s, ss, 10 * ONE, 2 * ONE);
    }

    function test_RevertWhen_NotOperator() public {
        OpenDEX.Order memory b = _order(buyer, true, 2 * ONE, 10 * ONE, 1);
        OpenDEX.Order memory s = _order(seller, false, 2 * ONE, 10 * ONE, 1);
        (bytes memory bs, bytes memory ss) = _sigs(b, s);
        vm.expectRevert(OpenDEX.NotOperator.selector);
        vm.prank(buyer);
        dex.settle(b, bs, s, ss, 10 * ONE, 2 * ONE);
    }

    function test_RevertWhen_Expired() public {
        OpenDEX.Order memory b = _order(buyer, true, 2 * ONE, 10 * ONE, 1);
        OpenDEX.Order memory s = _order(seller, false, 2 * ONE, 10 * ONE, 1);
        (bytes memory bs, bytes memory ss) = _sigs(b, s);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(OpenDEX.OrderExpired.selector);
        vm.prank(operator);
        dex.settle(b, bs, s, ss, 10 * ONE, 2 * ONE);
    }
}
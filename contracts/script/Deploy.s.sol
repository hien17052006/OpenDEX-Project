// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TestToken} from "../src/TestToken.sol";
import {OpenDEX} from "../src/OpenDEX.sol";

contract Deploy is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(key);
        address operator = vm.envOr("OPERATOR", deployer);
        address trader1 = vm.envOr("TRADER1", address(0));
        address trader2 = vm.envOr("TRADER2", address(0));

        vm.startBroadcast(key);
        TestToken gold = new TestToken("Gold", "GOLD");
        TestToken usdx = new TestToken("USD Experimental", "USDx");
        OpenDEX dex = new OpenDEX(IERC20(address(gold)), IERC20(address(usdx)), operator);
        if (trader1 != address(0)) {
            gold.mint(trader1, 10_000 ether);
            usdx.mint(trader1, 100_000 ether);
        }
        if (trader2 != address(0)) {
            gold.mint(trader2, 10_000 ether);
            usdx.mint(trader2, 100_000 ether);
        }
        vm.stopBroadcast();

        console.log("Deployer:", deployer);
        console.log("Operator:", operator);
        console.log("GOLD:", address(gold));
        console.log("USDx:", address(usdx));
        console.log("OpenDEX:", address(dex));
    }
}
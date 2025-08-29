import { Router } from "express";
import checkAuth from "../../middleware/check.auth";
import { Role } from "../user/user.interface";
import validateRequest from "../../middleware/validateRequest";
import { sendMoney, transactionZodValidation } from "../transactions/transactions.validation";
import { WalletController } from "./wallet.controller";

export const WalletRoutes = Router()

WalletRoutes.get("/transactionHistory", checkAuth(...Object.values(Role)), WalletController.transactionHistory)
WalletRoutes.post("/moneyActions", checkAuth(...Object.values(Role)), validateRequest(transactionZodValidation), WalletController.moneyActions)
WalletRoutes.post("/sendMoney/:id", checkAuth(...Object.values(Role)), validateRequest(sendMoney), WalletController.sendMoney)
WalletRoutes.post("/cashOut/:id", checkAuth("AGENT", "ADMIN"), validateRequest(sendMoney), WalletController.sendMoney)
WalletRoutes.get("/getInfo", checkAuth(...Object.values(Role)), WalletController.getInfo)

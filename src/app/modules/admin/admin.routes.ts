import { Router } from "express";
import checkAuth from "../../middleware/check.auth";
import { AdminController } from "./admin.controller";

export const AdminRoutes = Router()

AdminRoutes.get("/getData", checkAuth("ADMIN"), AdminController.getData)
AdminRoutes.patch("/walletAction/:action/:userId", checkAuth("ADMIN"), AdminController.walletAction)
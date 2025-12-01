import { Router } from "express";
import { testConnection } from "../controllers/hotel.controller.js";

const router = Router();

router.get("/test", testConnection);

export default router;

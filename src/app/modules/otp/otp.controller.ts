import { Request, Response } from "express";
import { OTPService } from "./otp.service";
import sendResponse from "../../utils/sendResponse";
import catchAsync from "../../utils/catchAsync";


const sendOTP = catchAsync(async (req: Request, res: Response) => {
    
    const { email, role } = req.query
    const result =  await OTPService.sendOTP(email as string, role as string)
    
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "OTP sent successfully",
        data: result,
    });
})

const verifyOTP = catchAsync(async (req: Request, res: Response) => {
    const { email, otp , role} = req.body;    
    await OTPService.verifyOTP(email, otp, role)
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "OTP verified successfully",
        data: null,
    });
})

export const OTPController = {
    sendOTP,
    verifyOTP
};
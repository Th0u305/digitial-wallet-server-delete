import { Request, Response } from "express"
import catchAsync from "../../utils/catchAsync"
import { UserServices } from "./user.service"
import sendResponse from "../../utils/sendResponse"
import httpStatus from "http-status-codes"
import { JwtPayload } from "jsonwebtoken"


// create user
const createUser = catchAsync(async(req:Request, res:Response)=>{
    const result = await UserServices.createUserWithWallet(req.body)

    sendResponse(res,{
        success : result.success === false ? false : true,
        statusCode : result.success === false ? httpStatus.BAD_REQUEST : httpStatus.CREATED,
        message : result.message ? result.message : "User created successfully",
        data : result
    })
})

// update user
const updateUser = catchAsync( async(req:Request, res:Response)=>{
    const userId = req.params.id
    const verifiedToken = req.user    
    const payload = req.body
    
    const result = await UserServices.updateUser(userId, payload, verifiedToken as JwtPayload, res)

    sendResponse(res,{
        success : result.success === false ? false : true,
        statusCode : result.success === false ? httpStatus.BAD_REQUEST : httpStatus.OK,
        message : result.message ? result.message : "User updated successfully",
        data : result
    })
})


const getMe = catchAsync(async (req: Request, res: Response) => {

    const decodedToken = req.user as JwtPayload
    
    const result = await UserServices.getMe(decodedToken._id, decodedToken?.role);    

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Your profile Retrieved Successfully",
        data: {
            data: result.data,
            walletStatus : result.walletStatus
        }
    })
})


export const UserController = {
    createUser,
    updateUser,
    getMe
}
import httpStatus from "http-status-codes"
import catchAsync from "../../utils/catchAsync"
import { Request, Response } from "express"
import { JwtPayload } from "jsonwebtoken"
import { WalletService } from "./wallet.service"
import sendResponse from "../../utils/sendResponse"


const moneyActions = catchAsync( async(req:Request, res:Response)=>{
    const data = req.body
    const verifiedToken = req.user  
      
    const result = await WalletService.moneyActions(data, verifiedToken as JwtPayload)

    sendResponse(res,{
        success : result.success === false ? false : true,
        statusCode : result.success === false ? httpStatus.BAD_REQUEST : httpStatus.CREATED,
        message : result.message ? result.message : "Transaction completed",
        data : result
    })
})

// send money 
const sendMoney = catchAsync( async (req: Request, res:Response)=>{

    const paramsId = req.params.id
    const decodedToken = req.user
    const { amount , transactionType } = req.body

    const result = await WalletService.sendMoney(paramsId, amount, transactionType , decodedToken as JwtPayload)

    sendResponse(res,{
        success : result?.success === false ? false : true,
        statusCode : result?.success === false ? httpStatus.BAD_REQUEST : httpStatus.OK,
        message : result?.message ? result?.message : "Successfully send money",
        data : result
    })
})

// send money 
const cashOut = catchAsync( async (req: Request, res:Response)=>{

    const paramsId = req.params.id
    const decodedToken = req.user
    const { amount , transactionType } = req.body

    const result = await WalletService.sendMoney(paramsId, amount, transactionType , decodedToken as JwtPayload)

    sendResponse(res,{
        success : result?.success === false ? false : true,
        statusCode : result?.success === false ? httpStatus.BAD_REQUEST : httpStatus.OK,
        message : result?.message ? result?.message : "Successfully send money",
        data : result
    })
})

// view transaction history
const transactionHistory = catchAsync( async( req:Request, res:Response)=>{

    const decodedToken = req.user
    const page = Number(req.query.page)
    

    const result = await WalletService.transactionHistory(decodedToken as JwtPayload, page)

    sendResponse(res,{
        success: true,
        statusCode : httpStatus.OK,
        message : "Successfully retrieved transaction history",
        data : {
            data : result.data,
            meta : result.count
        },
    })
})

const getInfo = catchAsync(async (req: Request, res: Response) => {

    const decodedToken = req.user as JwtPayload
    
    const result = await WalletService.getInfo(decodedToken._id, decodedToken?.role);    

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Data Retrieved Successfully",
        data: result.data
    })
})

export const WalletController = {
    moneyActions,
    sendMoney,
    transactionHistory,
    getInfo,
    cashOut
}
import { ITransaction, PAYMENT_STATUS, TransactionType } from "../transactions/transactions.interface"
import { JwtPayload } from "jsonwebtoken"
import { User } from "../user/user.model"
import { Transaction } from "../transactions/transactions.model"
import { Wallet } from "./wallet.model"
import mongoose from "mongoose"
import { Role } from "../user/user.interface"
import { Agent } from "../agent/agent.model"
import AppError from "../../errorHelper/AppError"
import httpStatus from "http-status-codes"
import { WalletStatus } from "./wallet.interface"
import DbModel from "../../utils/DbModel"


const genTransactionId = ( ) => {

    const timestamp = Date.now() + Math.random().toString(36).substring(2, 7)
    const randString = Math.random().toString(36).substring(2, 15).toUpperCase()

    return timestamp + randString;
}

// add money
const moneyActions = async (payload: Partial<ITransaction>, decodedToken: JwtPayload) =>{

    const { amount, transactionType: payloadTrans } = payload
    const {_id, role} = decodedToken
    const randomId = genTransactionId()

    if (!amount) {
        return { success: false, message: "Amount is missing" }
    }

    const Model = await DbModel(role)

    const isUserExists = await Model.findById({_id})    


    if (!isUserExists) {
        return { success: false, message: "User not found" }
    }    
    
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const wallet = await Wallet.findById({ _id: isUserExists.walletId }).session(session);

        if (!wallet) {
            return { success: false, message: 'Wallet not found or does not belong to the user.' }
        }

        if (wallet.walletStatus !== WalletStatus.ACTIVE) {
            return { success : false, message :  `Your wallet is ${wallet.walletStatus?.toLocaleLowerCase()} . Please consult with admin` }
        }

        if (payload.transactionType === TransactionType.SEND_MONEY) {
            return { success : false, message :  "You cannot perform this action" } 
        }

        if (payload.transactionType === TransactionType.WITHDRAW || payload.transactionType === TransactionType.CASH_OUT){
                             
            if (wallet.balance < amount) {
                return { success: false, message: 'Insufficient funds for this operation.' }
            }
            wallet.balance -= amount;

            // return { success : false , message : "You cannot perform this action"}

        }else if (payload.transactionType === TransactionType.ADD_MONEY) {
            wallet.balance += amount;
        }

        const transactionData = new Transaction(
            {
                userId : isUserExists._id,
                walletId : isUserExists.walletId,
                userModel : isUserExists.role.toLowerCase(),
                amount : amount,
                status : PAYMENT_STATUS.COMPLETED,
                transactionType : payloadTrans,
                transactionId : randomId
            }
        )

        await transactionData.save({session})

        if (!wallet.transactionId) {
            wallet.transactionId = []; // Initialize if it doesn't exist
        }

        wallet.transactionId.push(transactionData._id)

        await wallet.save({session})

        await session.commitTransaction()

        return transactionData

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error:any) {

        await session.abortTransaction()
        return { success: false, message:  `Transaction failed: ${error.message}` }

    }finally{
        session.endSession()
    }    
}

// agent send money to any & user,"SEND_MONEY"
const sendMoney = async (paramsId : string , amount : number , transType : string , decodedToken : JwtPayload) =>{

    if (!paramsId) {
        throw new AppError(httpStatus.NOT_FOUND, "Id missing")
    }
    if (!amount) {
        throw new AppError(httpStatus.NOT_FOUND, "Amount is missing")   
    }
    if (!transType) {
        throw new AppError(httpStatus.NOT_FOUND, "TransactionType is missing")   
    }

    if (transType === TransactionType.ADD_MONEY) {
        throw new AppError(httpStatus.FORBIDDEN, "You cannot perform this action")
    }

    const Model = await DbModel(decodedToken.role)

    const senderUser = await Model.findById(decodedToken._id) 
    let receiverUser = await User.findOne({email : paramsId}) 
    
    if (!senderUser) {
        throw new AppError (httpStatus.NOT_FOUND, "This user account doesn't exists")
    }
    
    if (!receiverUser) {
        receiverUser = await Agent.findOne({email : paramsId}) 
    }

    if (receiverUser?.role === Role.AGENT && senderUser?.role === Role.USER) {
        throw new AppError(httpStatus.BAD_REQUEST, `User cannot ${transType.toLowerCase()} to agent`)
    }

    const senderWallet = await Wallet.findById(senderUser?.walletId)
    const receiverWallet = await Wallet.findById(receiverUser?.walletId)


    if (!senderWallet) {
        throw new AppError(httpStatus.NOT_FOUND, 'Wallet error')
    }

    if (senderWallet.walletStatus !== WalletStatus.ACTIVE) {
        throw new AppError(httpStatus.FORBIDDEN, `Your account is ${senderWallet.walletStatus?.toLocaleLowerCase()} . Please consult with admin`)
    }

    if (!receiverUser) {
        throw new AppError (httpStatus.NOT_FOUND, "Wrong email address")
    }
    if (!receiverWallet) {
        throw new AppError(httpStatus.NOT_FOUND, 'Wallet error')
    }

    if (receiverWallet.walletStatus !== WalletStatus.ACTIVE) {
        throw new AppError(httpStatus.FORBIDDEN, `Receiver account is ${receiverWallet.walletStatus?.toLocaleLowerCase()} . Please consult with admin`)
    }


    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        if (transType !== TransactionType.SEND_MONEY && transType !== TransactionType.CASH_IN) {
            throw new AppError(httpStatus.FORBIDDEN, "You cannot perform this action")
        }
        

        if (senderWallet.balance < amount) {
            return { success: false, message: 'Insufficient funds for this operation.' }
        }
        senderWallet.balance -= amount;
        const randomId = genTransactionId()

        
        const transactionData = new Transaction(
            {
                userId : senderUser._id,
                walletId : senderUser.walletId,
                userModel : senderUser.role.toLowerCase(),
                amount : amount,
                status : transType === TransactionType.SEND_MONEY ? PAYMENT_STATUS.SEND : PAYMENT_STATUS.COMPLETED,
                transactionType : transType,
                transactionId : randomId,
                sendMoney : {
                    amount : amount,
                    receiverId : receiverUser._id,
                    senderId : senderUser._id,
                    senderRole : senderUser.role,
                    message :  `An ${senderUser.role.toLocaleLowerCase()} Successfully ${transType.toLocaleLowerCase()} ${amount} money to ${receiverUser.role.toLocaleLowerCase()}`
                }
            }
        )

        await transactionData.save({session})

        receiverWallet.balance += amount
        senderWallet.transactionId?.push(transactionData._id)
        
        await senderWallet.save({session})
        await receiverWallet.save({session})

        await session.commitTransaction()

        return transactionData

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error:any) {

        await session.abortTransaction()
        return { success: false, message:  `Transaction failed: ${error.message}` }
        
    }finally{
        session.endSession()
    }
}

// "CASH_OUT" 
const cashOut = async (paramsId : string , amount : number , transType : string , decodedToken : JwtPayload) =>{

    if (!paramsId) {
        throw new AppError(httpStatus.NOT_FOUND, "Id missing")
    }
    if (!amount) {
        throw new AppError(httpStatus.NOT_FOUND, "Amount is missing")   
    }
    if (!transType) {
        throw new AppError(httpStatus.NOT_FOUND, "TransactionType is missing")   
    }

    if (transType !== TransactionType.CASH_OUT) {
        throw new AppError(httpStatus.FORBIDDEN, "You cannot perform this action")
    }

    const Model = await DbModel(decodedToken.role)

    const agent = await Model.findById(decodedToken._id) 
    let customer = await User.findOne({email : paramsId}) 
    
    if (!agent) {
        throw new AppError (httpStatus.NOT_FOUND, "This user account doesn't exists")
    }
    
    if (!customer) {
        customer = await Agent.findOne({email : paramsId}) 
    }

    const agentWallet = await Wallet.findById(agent?.walletId)
    const customerWallet = await Wallet.findById(customer?.walletId)


    if (!agentWallet) {
        throw new AppError(httpStatus.NOT_FOUND, 'Wallet error')
    }

    if (agentWallet.walletStatus !== WalletStatus.ACTIVE) {
        throw new AppError(httpStatus.FORBIDDEN, `Your account is ${agentWallet.walletStatus?.toLocaleLowerCase()} . Please consult with admin`)
    }

    if (!customer) {
        throw new AppError (httpStatus.NOT_FOUND, "Wrong email address")
    }
    if (!customerWallet) {
        throw new AppError(httpStatus.NOT_FOUND, 'Wallet error')
    }

    if (customerWallet.walletStatus !== WalletStatus.ACTIVE) {
        throw new AppError(httpStatus.FORBIDDEN, `Customer account is ${customerWallet.walletStatus?.toLocaleLowerCase()} . Please consult with admin`)
    }


    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        if (transType !== TransactionType.CASH_OUT) {
            throw new AppError(httpStatus.FORBIDDEN, "You cannot perform this action")
        }
        

        if (customerWallet.balance < amount) {
            return { success: false, message: "Customer doesn't have funds to cash out" }
        }
        customerWallet.balance -= amount;
        const randomId = genTransactionId()

        
        const transactionData = new Transaction(
            {
                userId : customer._id,
                walletId : customerWallet.walletId,
                userModel : customer.role.toLowerCase(),
                amount : amount,
                status : PAYMENT_STATUS.COMPLETED,
                transactionType : transType,
                transactionId : randomId,
                sendMoney : {
                    amount : amount,
                    receiverId : agent._id,
                    senderId : customer._id,
                    senderRole : customer.role,
                    message :  `An ${customer.role.toLowerCase()} Successfully ${transType.toLocaleLowerCase()} ${amount} money from ${agent.role.toLowerCase()}`
                }
            }
        )

        await transactionData.save({session})

        agent.balance += amount
        customerWallet.transactionId?.push(transactionData._id)
        
        await customerWallet.save({session})
        await agentWallet.save({session})

        await session.commitTransaction()

        return transactionData

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error:any) {

        await session.abortTransaction()
        return { success: false, message:  `Transaction failed: ${error.message}` }
        
    }finally{
        session.endSession()
    }
}

const transactionHistory =  async(decodedToken: JwtPayload, page : number)=>{

    const skip = (page - 1) * 10;

    const Model = await DbModel(decodedToken.role)
    const isUserExists = await Model.findById(decodedToken._id)

    if (!isUserExists) {
        throw new AppError (httpStatus.NOT_FOUND, "This user doesn't exists")
    }

    const userWallet = await Wallet.findById(isUserExists?.walletId)

    if (!userWallet) {
        throw new AppError(httpStatus.NOT_FOUND, ' Wallet not found or does not belong to the user.')
    }
    if (userWallet.walletStatus !== WalletStatus.ACTIVE) {
        throw new AppError(httpStatus.FORBIDDEN, `Your account is ${userWallet.walletStatus?.toLocaleLowerCase()} . Please consult with admin`)
    }

    const history = await Transaction.find({_id : { $in : userWallet.transactionId}}).sort({ updatedAt : -1}).skip(skip).limit(10)
    const count = await Transaction.find({_id : { $in : userWallet.transactionId}}).countDocuments()

    const totalMoney = await Transaction.aggregate([

        {
           $match: {
             _id: { $in: userWallet.transactionId }
           }
        },
     
        {
            $group: {
             _id: null, // Group all documents into a single group
             totalMoney: { $sum: "$amount" } // Sum the 'amount' field from each document
            }
        }
    ]);
    
    
    return {
        data : history,
        count : {
            total : count,
            totalMoney,
            skip,
            limit : 10
        }
    }
}


const getInfo = async (userId: string, role: string) => {

    const Model = await DbModel(role)

    const user = await Model.findById(userId).select("-password");

    const wallet = await Wallet.findById(user.walletId)
    const count = await Transaction.find({_id : { $in : wallet?.transactionId}}).countDocuments()


    // const transactions = await Wallet.aggregate(
    //     [
    //         {
    //             $lookup : {
    //                 from : "transactions",
    //                 localField : "transactionId",
    //                 foreignField : "_id",
    //                 as : "allTransactions"
    //             }
    //         },
    //         {
    //             $unwind : "$allTransactions"
    //         },
    //         {
    //             $replaceRoot : {
    //                 newRoot : "$allTransactions"
    //             }
    //         },
    //         {
    //             $count : "totalTransactions"
    //         }
    //     ]
    // )
    
    return {
        data: {
            wallet : wallet,
            allTransactions : count
        }
    }
};

export const WalletService = {
    moneyActions,
    sendMoney,
    transactionHistory,
    getInfo,
    cashOut
}
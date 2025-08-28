import { JwtPayload } from "jsonwebtoken"
import AppError from "../../errorHelper/AppError"
import { Encrypt } from "../../utils/encrypt"
import { IAuthProvider, IUser } from "./user.interface"
import { User } from "./user.model"
import httpStatus from "http-status-codes"
import { Response } from "express"
import { Wallet } from "../wallet/wallet.model"
import mongoose from "mongoose"
import { IAgent } from "../agent/agent.interface"
import DbModel from "../../utils/DbModel"

// create user
const createUserWithWallet = async (payload: Partial<IUser | IAgent>) =>{
    
    const { email, password, ...rest} = payload

    const isUserExist = await User.findOne({ email });

    if (isUserExist) {            
        throw new AppError(httpStatus.BAD_REQUEST, "User with this email already exists.");
    }
    
    // start user session
    const session = await mongoose.startSession();

    try {

        // Start the transaction
        session.startTransaction();
   
        const hashedPassword = await Encrypt.hashPassword(password as string);
        const authProvider: IAuthProvider = { provider: "credentials", providerId: email as string };

        // Create the user 
        const newUser = new User({
            email,
            password: hashedPassword,
            auths: authProvider,
            ...rest
        });

        // Saving the user to the database within the session
        const createdUser = await newUser.save({ session });


        // Create the wallet, linking it to the new user
        const newWallet = await Wallet.create([{
            userId: createdUser._id, // userId
            userModel : "user"
        }], { session });


        //  Update the user with the new wallet's ID 
        createdUser.walletId = newWallet[0]._id; // wallet Id
        await createdUser.save({ session });

        // commit the transaction
        await session.commitTransaction();
        
        return createdUser;
        
    }catch (error) {

        // If any error occurs, abort the entire transaction
        await session.abortTransaction();        
        return { success: false, message: 'Failed to create user and wallet.', error }

    }finally{

        // Finally, always end the session
        session.endSession();
    }
}

// update user
const updateUser = async (userId: string, payload: Partial<IAgent>, decodedToken: JwtPayload, res:Response) =>{

    const Model = await DbModel(decodedToken.role)

    const session = await mongoose.startSession()

    try {

        session.startTransaction()

        const isUserExists = await Model.findById(userId).session(session)

        if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found")
    }

    if (decodedToken._id !== userId || isUserExists?._id.toString() !== userId) {
        res.clearCookie("accessToken", {
          httpOnly : true,
          secure : true,
          sameSite : "lax"
        })
        res.clearCookie("refreshToken", {
          httpOnly : true,
          secure : true,
          sameSite : "lax"
        })
        throw new AppError(httpStatus.FORBIDDEN , "Token error, Logging out user")
    }

    let hasChanges = false

    for (const fieldsData in payload ) {
            if (payload[fieldsData as keyof IAgent ] !== isUserExists[fieldsData as keyof IAgent]) {
            hasChanges = true
            break
        }
    }

    if (!hasChanges) {
        throw new AppError(httpStatus.BAD_REQUEST, "Please provide new data to update.")
    }

    const newUpdateUser = await Model.findByIdAndUpdate(userId, payload , {new: true, runValidators : true}).select("-password").session(session)

    await session.commitTransaction()    
    return newUpdateUser

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error:any) {
        await session.abortTransaction()
        return { success: false, message:  `Transaction failed: ${error.message}`}    
    }finally{
        session.endSession()
    }
}

const getMe = async (userId: string, role: string) => {

    const Model = await DbModel(role)

    const user = await Model.findById(userId).select("-password")
    const data = await Wallet.findById(user?.walletId)
    
    
    return {
        data: user,
        walletStatus : data?.walletStatus
    }
};


export const UserServices = {
    createUserWithWallet,
    updateUser,
    getMe
}
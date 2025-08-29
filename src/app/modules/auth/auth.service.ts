import AppError from "../../errorHelper/AppError";
import { User } from "../user/user.model";
import httpStatus from "http-status-codes"
import jwt,  { JwtPayload } from "jsonwebtoken";
import { Encrypt } from "../../utils/encrypt";
import { IAuthProvider, IsActive } from "../user/user.interface";
import { envVars } from "../../config/env";
import DbModel from "../../utils/DbModel";
import { Agent } from "../agent/agent.model";

const resetPassword = async (oldPassword: string, newPassword: string, decodedToken: JwtPayload) =>{

    const Modal = await DbModel(decodedToken.role)
    const user = await Modal.findById(decodedToken._id) 
    const isOldPasswordMatch = await Encrypt.compare(oldPassword, user?.password as string)

    if (!isOldPasswordMatch) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Your password does not match");
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    user!.password = await Encrypt.hashPassword(newPassword as string)
    user?.save()   

}

const changePassword = async (oldPassword: string, newPassword: string, decodedToken: JwtPayload) =>{

    const Modal = await DbModel(decodedToken.role)
    const user = await Modal.findById(decodedToken._id)

    const isOldPasswordMatch = await Encrypt.compare(oldPassword, user?.password as string)

    if (!isOldPasswordMatch) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Old password does not match");
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    user!.password = await Encrypt.hashPassword(newPassword)

    user?.save()
}

const setPassword = async (decodedToken: JwtPayload, plainPassword: string) =>{

    const Modal = await DbModel(decodedToken.role)
    const user = await Modal.findById(decodedToken.userId);

    if (!user) {
        throw new AppError(404, "User not found");
    }

    if (user.password && user.auths.provider === "google") {
        throw new AppError(httpStatus.BAD_REQUEST, "You have already set you password. Now you can change the password from your profile password update")
    }

    const hashedPassword = await Encrypt.hashPassword(plainPassword)

    const credentialProvider: IAuthProvider = {
        provider: "credentials",
        providerId: user.email
    }

    const auths: IAuthProvider = credentialProvider

    user.password = hashedPassword

    user.auths = auths

    await user.save()
}

const forgotPassword = async (email: string) => {

    let isUserExist = await User.findOne({ email });

    if (!isUserExist) {
        isUserExist = await Agent.findOne({ email });
        throw new AppError(httpStatus.BAD_REQUEST, "User does not exist")
    }
    if (!isUserExist.isVerified) {
        throw new AppError(httpStatus.BAD_REQUEST, "User is not verified")
    }
    if (isUserExist.isActive === IsActive.BLOCKED || isUserExist.isActive === IsActive.INACTIVE) {
        throw new AppError(httpStatus.BAD_REQUEST, `User is ${isUserExist.isActive}`)
    }
    if (isUserExist.isDeleted) {
        throw new AppError(httpStatus.BAD_REQUEST, "User is deleted")
    }

    const jwtPayload = {
        userId: isUserExist._id,
        email: isUserExist.email,
        role: isUserExist.role
    }

    const resetToken = jwt.sign(jwtPayload, envVars.JWT_ACCESS_SECRET, {
        expiresIn: "10m"
    })

    const resetUILink = `${envVars.FRONTEND_URL}/reset-password?id=${isUserExist._id}&token=${resetToken}`

    return resetUILink

    /**
     * http://localhost:5173/reset-password?id=687f310c724151eb2fcf0c41&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODdmMzEwYzcyNDE1MWViMmZjZjBjNDEiLCJlbWFpbCI6InNhbWluaXNyYXI2QGdtYWlsLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzUzMTY2MTM3LCJleHAiOjE3NTMxNjY3Mzd9.LQgXBmyBpEPpAQyPjDNPL4m2xLF4XomfUPfoxeG0MKg
     */
}

export const AuthServices = {
    resetPassword,
    changePassword,
    setPassword,
    forgotPassword
}
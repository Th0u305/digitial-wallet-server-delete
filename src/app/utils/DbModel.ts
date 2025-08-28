import { Model } from "mongoose";
import AppError from "../errorHelper/AppError";
import httpStatus from "http-status-codes"
import { User } from "../modules/user/user.model";
import { Agent } from "../modules/agent/agent.model";

const DbModel = async (role:string) => {

     // eslint-disable-next-line @typescript-eslint/no-explicit-any
       let Model: Model<any>;

        switch (role?.toUpperCase()) {
        case 'USER':
            Model = User;
            break;
        case 'AGENT':
            Model = Agent
            break;
        case 'ADMIN':
            Model = User
            break;
        default:
            throw new AppError(httpStatus.BAD_REQUEST, 'Invalid role specified.');
    }

    return Model
            
      
};

export default DbModel;
/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Model, PipelineStage } from "mongoose";
import { Agent } from "../agent/agent.model"
import { User } from "../user/user.model"
import { Request } from "express";
import AppError from "../../errorHelper/AppError";
import httpStatus from "http-status-codes"
import { Wallet } from "../wallet/wallet.model";
import { Transaction } from "../transactions/transactions.model";
import z from "zod";
import { WalletStatus } from "../wallet/wallet.interface";

const querySchema = z.object({
    view: z.enum(['user', 'agent', 'wallet', 'transaction']).default("user"),
    filterBy: z.enum(['wallet', 'transaction']).optional().default("wallet"),
    walletStatus: z.enum(["BLOCKED", "ACTIVE", "SUSPENDED"]).optional().default('ACTIVE'),
    isVerified: z.string().default("true").optional(),
    sortBy: z.string().optional().default('createdAt'),
    search: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    limit: z.preprocess(val => parseInt(String(val), 10) || 10, z.number().min(1)),
    page: z.preprocess(val => parseInt(String(val), 10) || 1, z.number().min(1)),
});


export const getAggregatedData = async (req: Request) => {

    // --- 2. Validate and parse queries using the Zod schema ---
    const validatedQuery = querySchema.parse(req.query);
    const { view, filterBy, sortBy, sortOrder, limit, page, walletStatus, isVerified, search } = validatedQuery;
    const skip = (page - 1) * limit;

    // --- 3. Select the base model dynamically ---
    // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
    const modelMap: { [key: string]: Model<any> } = {
        user: User,
        agent: Agent,
        wallet: Wallet,
        transaction: Transaction,
    };
    const Model = modelMap[view];

    // --- 4. Build the aggregation pipeline dynamically ---
    const pipeline: PipelineStage[] = [];

    // --- ADD SEARCH AND FILTER STAGE EARLY ---
    const matchStage: Record<string, any> = {};

    // Add search filter for name and email
    if (search) {
        matchStage.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
    }

    // Add isVerified filter
    if (isVerified) {
        matchStage.isVerified = isVerified === 'false' ? false : true;
    }

    // Only push the initial match stage if there are filters to apply at this point
    if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
    }


    // Add wallet and transaction lookups only when necessary
    if (view === 'user' || view === 'agent') {
        pipeline.push(
            {
                $lookup: {
                    from: 'wallets',
                    localField: 'walletId',
                    foreignField: '_id',
                    as: 'walletData',
                },
            },
            { $unwind: { path: '$walletData', preserveNullAndEmptyArrays: true } },
            {
                $project : {
                    password : 0
                }
            }
        );

        // Add walletStatus filter AFTER the wallet data is available
        if (walletStatus) {
            pipeline.push({ $match: { 'walletData.walletStatus': walletStatus } });
        }

        if (filterBy === "transaction") {
            pipeline.push(
                {
                    $addFields : {
                        walletBalance : "$walletData.balance",
                        walletStatus : "$walletData.walletStatus"
                    }
                },
            )
        }

        pipeline.push(
            {
                $lookup: {
                    from: 'transactions',
                    localField: 'walletData.transactionId',
                    foreignField: '_id',
                    as: 'allTransactions',
                },
            },
            {
                $addFields : {
                    transactionCount : { $size : "$allTransactions"}
                }
            }
        )
    } else if (view === 'wallet') {
        pipeline.push(
            {
                $lookup: {
                    from: 'transactions',
                    localField: 'transactionId',
                    foreignField: '_id',
                    as: 'allTransactions',
                },
            },
        )
    }

    // --- 5. Add a projection stage to conditionally remove data ---
    const projectStage: Record<string, any> = {};
    if (filterBy === 'wallet') {
        projectStage.allTransactions = 0; // Hide transactions
    } else if (filterBy === 'transaction') {
        projectStage.walletData = 0; // Hide wallet data
    }
    
    // Only add the project stage if there's something to project
    if (Object.keys(projectStage).length > 0) {
        pipeline.push({ $project: projectStage });
    }

    // --- 6. Use $facet to get both data and total count in one query ---
    pipeline.push({
        $facet: {
            metadata: [{ $count: 'total' }],
            data: [
                { $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 } },
                { $skip: skip },
                { $limit: limit },
            ],
        },
    })

    // --- 7. Execute the pipeline ---
    const result = await Model.aggregate(pipeline);

    const data = result[0].data;
    const total = result[0].metadata[0]?.total || 0;

    return {
        meta: {
            page,
            limit,
            total,
        },
        queries: validatedQuery,
        data,
    };
};


const walletAction = async (action : string , userId: string) => {
    
    let isUserExists 
    isUserExists = await User.findById(userId)
    
    if (!isUserExists) {
        isUserExists = await Agent.findById(userId)
    }
    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "This account doesn't exists")
    }

    if (action.toUpperCase() !== WalletStatus.ACTIVE && action.toUpperCase() !== WalletStatus.SUSPENDED && action.toUpperCase() !== WalletStatus.BLOCKED) {
        throw new AppError(httpStatus.BAD_REQUEST, "Please use a correct wallet action (e.g., ACTIVE, BLOCKED, SUSPENDED)");
    }

    const session = await mongoose.startSession();

    try {

        session.startTransaction();

        const isWallet = await Wallet.findByIdAndUpdate(
            isUserExists?.walletId,
            { walletStatus : action.toLocaleUpperCase()},
            { new: true, runValidators: true, session}
        )

        if (!isWallet) {
            return { success: false, message: 'This account Wallet not found or does not belong to the user.'}
        }

        await session.commitTransaction()
    
        return isWallet

    } catch (error:any) {

        await session.abortTransaction()
        return { success: false, message:  `Transaction failed: ${error.message}`}    

    }finally{
            
        session.endSession()
    }   
};

export const AdminService = {
    getAggregatedData,
    walletAction
}
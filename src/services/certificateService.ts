import { ClientSession } from "mongoose";
import Counter from "../models/counterModel";
import { getLgaCode, getStateCode } from "../utils/lgaCodes";

const CertificateService = {
    certificateReference: async (
        application: { stateOfOrigin: string; lga: string },
        session?: ClientSession
    ): Promise<string> => {
        const stateCode = getStateCode(application.stateOfOrigin);
        const lgaCode = getLgaCode(application.stateOfOrigin, application.lga);

        // atomic increment: safe when two admins approve at the same time
        const counter = await Counter.findOneAndUpdate(
            { _id: `${stateCode}-${lgaCode}-CO` },
            { $inc: { seq: 1 } },
            { upsert: true, new: true, session }
        );

        return `${stateCode}/${lgaCode}/CO/${String(counter.seq).padStart(9, "0")}`;
    }
};

export default CertificateService;
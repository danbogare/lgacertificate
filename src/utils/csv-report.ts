import { IApplication } from "../models/application.model";
import { format } from "fast-csv";
import { Writable } from "stream";
import { IAdmin } from "../models/admin.model";

// approvedBy/rejectedBy are only admin documents when the query populated them
function formatReviewer(reviewer: unknown): string {
    if (!reviewer || typeof reviewer !== "object" || !("firstName" in reviewer)) return "N/A";
    const { firstName, lastName, position } = reviewer as IAdmin;
    const name = `${firstName} ${lastName}`;
    return position ? `${name} (${position})` : name;
}

// Only super admins' reviewer lookups select email; officials' leave it out
function reviewerEmail(reviewer: unknown): string {
    if (!reviewer || typeof reviewer !== "object") return "N/A";
    return (reviewer as IAdmin).email || "N/A";
}

export async function generateApplicationReportCsv(data: IApplication[]): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Uint8Array[] = [];

        const writableStream = new Writable({
            write(chunk, _, callback) {
                chunks.push(chunk);
                callback();
            }
        });

        const csvStream = format({ headers: true });

        csvStream.pipe(writableStream)
            .on("finish", () => resolve(Buffer.concat(chunks)))
            .on("error", reject);

        data.forEach((application, index) => {
            csvStream.write({
                "S/N": index + 1,
                "Full Names": application.fullNames,
                "NIN": application.nin || "N/A",
                "Father's Name": application.fatherNames || "N/A",
                "Mother's Name": application.motherNames || "N/A",
                "Native Town": application.nativeTown || "N/A",
                "Native Political Ward": application.nativePoliticalWard || "N/A",
                "Village": application.village || "N/A",
                "Community Head": application.communityHead || "N/A",
                "Community Head Contact": application.communityHeadContact || "N/A",
                "Current Address": application.currentAddress,
                "LGA": application.lga,
                "State of Origin": application.stateOfOrigin,
                "Is Resident of Ogun?": application.isResidentOfOgun ? "Yes" : "No",
                "LGA of Resident": application.lgaOfResident || "N/A",
                "Application Status": application.status,
                "Approved By": formatReviewer(application.approvedBy),
                "Approved By Email": reviewerEmail(application.approvedBy),
                "Rejected By": formatReviewer(application.rejectedBy),
                "Rejected By Email": reviewerEmail(application.rejectedBy),
                "Approval/Rejection Date": application.pendingApprovalRejectionDate
                    ? application.pendingApprovalRejectionDate.toISOString().split("T")[0]
                    : "N/A",
                "Date Created": application.createdAt
                    ? application.createdAt.toISOString().split("T")[0]
                    : "N/A",
                "Time Created": application.createdAt
                    ? application.createdAt.toISOString().split("T")[1]?.split(".")[0]
                    : "N/A",
            });
        });

        csvStream.end();
    });
}

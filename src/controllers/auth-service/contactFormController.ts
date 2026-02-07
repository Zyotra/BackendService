import { Context } from "elysia";
import sendContactEmail from "../../auth-modules/mail/sendContactEmail";
import { StatusCode } from "../../types/types";

interface ContactFormBody {
    email: string;
    phone?: string;
    address?: string;
    message: string;
}

const contactFormController = async ({ body, set }: Context) => {
    try {
        const req = body as ContactFormBody;

        // Basic validation
        if (!req.email || !req.message) {
            set.status = StatusCode.BAD_REQUEST;
            return {
                status: "error",
                message: "Email and message are required fields"
            };
        }

        // Send email
        await sendContactEmail({
            email: req.email,
            phone: req.phone,
            address: req.address,
            message: req.message
        });

        set.status = StatusCode.OK;
        return {
            status: "success",
            message: "Your message has been sent successfully"
        };
    } catch (error) {
        console.error("Contact form error:", error);
        set.status = StatusCode.INTERNAL_SERVER_ERROR;
        return {
            status: "error",
            message: "Failed to send message. Please try again later."
        };
    }
};

export default contactFormController;

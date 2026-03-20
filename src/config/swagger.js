import swaggerJSDoc from "swagger-jsdoc";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Canteen Pre-order API",
            version: "1.0.0",
            description:"MERN + Redis + Razorpay + Socket.io Backend",
        },
        servers: [
            {
                url:"http://localhost:5000",
            },
        ],
    },
    apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;








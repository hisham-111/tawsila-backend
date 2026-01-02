export const generateOrderNumber = () => {
    const timestampPart = Date.now().toString().slice(-10);
    const randomPart = Math.floor(Math.random() * 9000) + 1000;
    return `ORD-${timestampPart}-${randomPart}`;
};
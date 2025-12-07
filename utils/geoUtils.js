// src/utils/geoUtils.js

/**
 * 💡 لحساب المسافة بين نقطتين (بالكيلومتر) باستخدام صيغة هافيرسين
 * @param {number} lat1 - خط عرض النقطة الأولى
 * @param {number} lng1 - خط طول النقطة الأولى
 * @param {number} lat2 - خط عرض النقطة الثانية
 * @param {number} lng2 - خط طول النقطة الثانية
 * @returns {number} المسافة بالكيلومتر
 */
export const haversineDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // نصف قطر الأرض بالكيلومتر
    
    // تحويل الدرجات إلى راديان
    const toRad = (value) => (value * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // المسافة بالكيلومتر
};
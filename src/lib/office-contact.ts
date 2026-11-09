export const officePhone = "+233 24 115 2479";
const digits = officePhone.replace(/\D/g, "");
export const officeCall = "tel:+" + digits;
export const officeWhatsApp = "https://wa.me/" + digits;

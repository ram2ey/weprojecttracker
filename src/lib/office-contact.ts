export const officePhone = "+233 54 298 5346";
const digits = officePhone.replace(/\D/g, "");
export const officeCall = "tel:+" + digits;
export const officeWhatsApp = "https://wa.me/" + digits;

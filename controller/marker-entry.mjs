import QRCode from 'qrcode';
export const drawMarker=(canvas,payload)=>QRCode.toCanvas(canvas,payload,{width:600,margin:4,errorCorrectionLevel:'M'});

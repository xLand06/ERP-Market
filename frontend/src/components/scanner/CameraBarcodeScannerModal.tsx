import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, RefreshCw, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CameraBarcodeScannerModalProps {
    open: boolean;
    onClose: () => void;
    onScan: (barcode: string) => void;
}

export function CameraBarcodeScannerModal({ open, onClose, onScan }: CameraBarcodeScannerModalProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const elementId = 'html5-camera-barcode-scanner';

    useEffect(() => {
        if (!open) {
            stopScanner();
            return;
        }

        let isMounted = true;
        setCameraError(null);

        const initScanner = async () => {
            try {
                const devices = await Html5Qrcode.getCameras();
                if (isMounted && devices && devices.length > 0) {
                    setCameras(devices);
                    // Prefer back / environment camera
                    const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('trasera') || d.label.toLowerCase().includes('environment'));
                    const chosenId = backCamera ? backCamera.id : devices[0].id;
                    setSelectedCameraId(chosenId);
                    startScanner(chosenId);
                } else if (isMounted) {
                    setCameraError('No se detectaron cámaras disponibles en el dispositivo.');
                }
            } catch (err: any) {
                if (isMounted) {
                    setCameraError(err?.message || 'Permiso de cámara denegado o no disponible.');
                }
            }
        };

        // Delay slightly for modal DOM node mount
        const timer = setTimeout(initScanner, 300);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            stopScanner();
        };
    }, [open]);

    const startScanner = async (cameraId: string) => {
        try {
            if (scannerRef.current) {
                await stopScanner();
            }

            const html5Qrcode = new Html5Qrcode(elementId, {
                verbose: false,
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.QR_CODE,
                ]
            });
            scannerRef.current = html5Qrcode;

            await html5Qrcode.start(
                cameraId,
                {
                    fps: 15,
                    qrbox: { width: 260, height: 160 },
                    aspectRatio: 1.5,
                },
                (decodedText) => {
                    // Audio beep feedback
                    try {
                        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.frequency.value = 1000;
                        gain.gain.setValueAtTime(0.1, ctx.currentTime);
                        osc.start();
                        osc.stop(ctx.currentTime + 0.1);
                    } catch (e) {
                        // ignore audio errors
                    }

                    // Haptic feedback
                    if (navigator.vibrate) {
                        try { navigator.vibrate(100); } catch (e) { }
                    }

                    onScan(decodedText.trim());
                    onClose();
                },
                () => {
                    // Ignore decode failure per frame
                }
            );

            setIsScanning(true);
            setCameraError(null);
        } catch (err: any) {
            setIsScanning(false);
            setCameraError(err?.message || 'Error al iniciar la transmisión de video de la cámara.');
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                }
                scannerRef.current.clear();
            } catch (e) {
                // ignore stop errors
            }
            scannerRef.current = null;
        }
        setIsScanning(false);
    };

    const handleSwitchCamera = () => {
        if (cameras.length <= 1) return;
        const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
        const nextIndex = (currentIndex + 1) % cameras.length;
        const nextCameraId = cameras[nextIndex].id;
        setSelectedCameraId(nextCameraId);
        startScanner(nextCameraId);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-md p-0 overflow-hidden bg-slate-950 border-slate-800 text-white rounded-3xl shadow-2xl">
                <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800 flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-base font-black text-white flex items-center gap-2">
                            <Camera className="w-5 h-5 text-emerald-400" />
                            Escanear Código de Barras
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            Apunta la cámara de tu teléfono al código de barras del producto.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="relative min-h-[300px] flex items-center justify-center bg-black overflow-hidden">
                    {/* HTML5 Scanner Container */}
                    <div id={elementId} className="w-full h-full min-h-[280px]" />

                    {/* Viewfinder Target Frame Overlay */}
                    {isScanning && !cameraError && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-[260px] h-[160px] border-2 border-emerald-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col justify-between p-2 animate-pulse">
                                <div className="flex justify-between">
                                    <span className="w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
                                    <span className="w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
                                </div>
                                <div className="w-full h-0.5 bg-emerald-400/60 shadow-[0_0_8px_#34d399]" />
                                <div className="flex justify-between">
                                    <span className="w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
                                    <span className="w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Camera Error / Permission Fallback */}
                    {cameraError && (
                        <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-slate-900/95 space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center">
                                <Camera className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white mb-1">Acceso a Cámara Requerido</p>
                                <p className="text-xs text-slate-400 max-w-xs">{cameraError}</p>
                            </div>
                            {cameras.length > 0 && selectedCameraId && (
                                <Button
                                    size="sm"
                                    onClick={() => startScanner(selectedCameraId)}
                                    className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs"
                                >
                                    Reintentar Cámara
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
                    {cameras.length > 1 ? (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSwitchCamera}
                            className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 text-xs font-bold gap-1.5"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> Cambiar Cámara
                        </Button>
                    ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Lector Activo</span>
                    )}

                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={onClose}
                        className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4"
                    >
                        Cerrar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SHEET } from '@/components/shared';
import { Flashlight, X } from 'lucide-react';

type Detector = { detect: (v: CanvasImageSource) => Promise<{ rawValue: string }[]> };

const WANTED = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];

/**
 * Opens the phone camera and reads barcodes.
 * - Chrome on Android: the phone's own fast barcode reader.
 * - iPhone / other browsers: the ZXing reader (runs inside the app, also works without internet).
 * The same barcode is reported once while it stays in front of the camera; take it away and show it again to scan it again.
 */
export function BarcodeScanner({
  open, onClose, onDetect, paused = false, title = 'বারকোড স্ক্যান', children,
}: {
  open: boolean;
  onClose: () => void;
  onDetect: (code: string) => void;
  paused?: boolean; // stop reporting while the caller shows its own question
  title?: string;
  children?: React.ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const pausedRef = useRef(paused);
  onDetectRef.current = onDetect;
  pausedRef.current = paused;

  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const last = { code: '', seen: 0 };
    setError(''); setReady(false); setCanTorch(false); setTorchOn(false);

    const report = (code: string) => {
      const now = Date.now();
      const sameAsBefore = code === last.code && now - last.seen < 1200; // still in front of the camera
      last.code = code;
      last.seen = now;
      if (sameAsBefore || pausedRef.current) return;
      try { navigator.vibrate?.(60); } catch { /* ignore */ }
      onDetectRef.current(code);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('এই ব্রাউজারে ক্যামেরা চালানো যাচ্ছে না। Chrome (Android) বা Safari (iPhone) ব্যবহার করুন।');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);
        try {
          const caps = stream.getVideoTracks()[0]?.getCapabilities?.() as { torch?: boolean } | undefined;
          setCanTorch(!!caps?.torch);
        } catch { /* ignore */ }

        // 1) the phone's own reader, if it has one
        let detector: Detector | null = null;
        const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
        if (BD) {
          try {
            const supported = (await BD.getSupportedFormats?.()) ?? [];
            const formats = WANTED.filter(f => supported.includes(f));
            if (formats.length > 0) detector = new BD({ formats });
          } catch { detector = null; }
        }

        // 2) otherwise ZXing (works everywhere)
        let zx: { decode: (c: HTMLCanvasElement) => string | null } | null = null;
        if (!detector) {
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import('@zxing/browser'), import('@zxing/library'),
          ]);
          const hints = new Map<unknown, unknown>([
            [DecodeHintType.POSSIBLE_FORMATS, [
              BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
              BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.QR_CODE,
            ]],
            [DecodeHintType.TRY_HARDER, true],
          ]);
          const reader = new BrowserMultiFormatReader(hints as never);
          zx = {
            decode: canvas => {
              try { return reader.decodeFromCanvas(canvas).getText(); } catch { return null; }
            },
          };
        }
        if (stopped) return;

        const canvas = document.createElement('canvas');
        let busy = false;
        timer = setInterval(async () => {
          if (busy || stopped || video.readyState < 2) return;
          busy = true;
          try {
            let code: string | null = null;
            if (detector) {
              const found = await detector.detect(video);
              code = found[0]?.rawValue ?? null;
            } else if (zx) {
              const w = Math.min(video.videoWidth, 960);
              const h = Math.round((video.videoHeight * w) / video.videoWidth);
              canvas.width = w; canvas.height = h;
              canvas.getContext('2d', { willReadFrequently: true })!.drawImage(video, 0, 0, w, h);
              code = zx.decode(canvas);
            }
            if (code) report(code.trim());
          } catch { /* a frame that fails is fine, try the next one */ }
          busy = false;
        }, detector ? 120 : 160);
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setError(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'ক্যামেরার অনুমতি দিন। ব্রাউজারের ঠিকানার পাশের তালা/সেটিংস থেকে Camera → Allow করুন।'
            : name === 'NotFoundError'
              ? 'এই ফোনে ক্যামেরা পাওয়া যায়নি।'
              : 'ক্যামেরা চালু করা যায়নি। অন্য কোনো অ্যাপ ক্যামেরা ব্যবহার করছে কি না দেখুন।',
        );
      }
    };
    void start();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(v => !v);
    } catch { /* ignore */ }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${SHEET} sm:max-w-md`}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

        <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '4 / 3' }}>
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" aria-label="ক্যামেরা" />
          {ready && !error && (
            <>
              {/* aiming frame */}
              <div className="pointer-events-none absolute inset-x-[10%] inset-y-[25%] rounded-lg border-2 border-emerald-400/90" />
              <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-red-500/80" />
            </>
          )}
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">ক্যামেরা চালু হচ্ছে…</div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white">{error}</div>
          )}
          {canTorch && (
            <Button type="button" size="icon" variant="secondary" className="absolute bottom-2 right-2 h-10 w-10 rounded-full"
              aria-label="টর্চ" onClick={toggleTorch}>
              <Flashlight className={torchOn ? 'text-amber-500' : ''} />
            </Button>
          )}
        </div>

        {!error && <p className="text-center text-xs text-slate-500">বারকোডটা সবুজ বক্সের ভেতরে ধরুন</p>}
        {children}

        <Button type="button" variant="outline" className="h-11 w-full" onClick={onClose}>
          <X /> বন্ধ করুন
        </Button>
      </DialogContent>
    </Dialog>
  );
}

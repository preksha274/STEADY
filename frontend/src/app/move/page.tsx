// DeviceMotion Event Listener for Real Accel/Gyro Peak Detection
useEffect(() => {
  if (!isSessionActive || isPaused || isHardStopped || typeof window === "undefined") return;

  const handleMotionEvent = (event: DeviceMotionEvent) => {
    const accel = event.acceleration || event.accelerationIncludingGravity;
    if (!accel || accel.x === null || accel.y === null || accel.z === null) return;

    if (!cameraActive) {
      setActiveInputSource("Motion Sensor");
    }

    const rawMag = Math.sqrt(
      accel.x * accel.x + accel.y * accel.y + accel.z * accel.z
    );
    const netMag = Math.abs(rawMag - 9.8);
    const now = Date.now();

    // Minimum peak interval based on pacing tempo.
    // At 40 BPM this is 900ms, with a 380ms lower bound.
    const minIntervalMs = Math.max(380, (60 / currentBpm) * 600);

    const isPeak =
      now - lastPeakTimeRef.current >= minIntervalMs &&
      netMag > 1.15 &&
      prevAccelMagRef.current <= 1.15;

    prevAccelMagRef.current = netMag;

    if (isPeak) {
      lastPeakTimeRef.current = now;
      registerMovementPeak(netMag, now);
    }
  };

  if ("DeviceMotionEvent" in window) {
    window.addEventListener("devicemotion", handleMotionEvent);
  }

  return () => {
    if ("DeviceMotionEvent" in window) {
      window.removeEventListener("devicemotion", handleMotionEvent);
    }
  };
}, [
  isSessionActive,
  isPaused,
  isHardStopped,
  currentBpm,
  cameraActive,
]);


// Camera Optical Frame Difference Peak Detector
useEffect(() => {
  if (!isSessionActive || !cameraActive || isPaused || isHardStopped) return;

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  const frameInterval = setInterval(() => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended || video.readyState < 2) return;

    try {
      ctx.drawImage(video, 0, 0, 32, 32);
      const frame = ctx.getImageData(0, 0, 32, 32);
      const data = frame.data;

      if (prevFrameDataRef.current) {
        let upperDiff = 0;
        let midDiff = 0;
        let lowerDiff = 0;

        let upperCount = 0;
        let midCount = 0;
        let lowerCount = 0;

        const prev = prevFrameDataRef.current;

        // Divide the frame into upper, middle, and lower body regions.
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            const i = (y * 32 + x) * 4;

            const curLuma =
              (data[i] + data[i + 1] + data[i + 2]) / 3;
            const prevLuma =
              (prev[i] + prev[i + 1] + prev[i + 2]) / 3;

            const diff = Math.abs(curLuma - prevLuma);

            if (y < 11) {
              upperDiff += diff;
              upperCount++;
            } else if (y < 22) {
              midDiff += diff;
              midCount++;
            } else {
              lowerDiff += diff;
              lowerCount++;
            }
          }
        }

        const upperEnergy = upperDiff / upperCount;
        const midEnergy = midDiff / midCount;
        const lowerEnergy = lowerDiff / lowerCount;

        const totalEnergy =
          (upperDiff + midDiff + lowerDiff) / (32 * 32);

        // 4-frame moving average smoothing buffer.
        movingAvgBufferRef.current.push({
          upper: upperEnergy,
          mid: midEnergy,
          lower: lowerEnergy,
          total: totalEnergy,
        });

        if (movingAvgBufferRef.current.length > 4) {
          movingAvgBufferRef.current.shift();
        }

        const len = movingAvgBufferRef.current.length;

        const smoothed = movingAvgBufferRef.current.reduce(
          (acc, item) => ({
            upper: acc.upper + item.upper / len,
            mid: acc.mid + item.mid / len,
            lower: acc.lower + item.lower / len,
            total: acc.total + item.total / len,
          }),
          {
            upper: 0,
            mid: 0,
            lower: 0,
            total: 0,
          }
        );

        lastRegionMotionRef.current = smoothed;

        const now = Date.now();

        // Camera tracking uses the same 3-second-per-rep cadence
        // as the visual exercise guide.
        const minIntervalMs = 2100;

        if (
          smoothed.total > 5.0 &&
          prevFrameEnergyRef.current <= 5.0 &&
          now - lastCameraPeakTimeRef.current >= minIntervalMs
        ) {
          lastCameraPeakTimeRef.current = now;
          registerMovementPeak(smoothed.total / 5, now);
        }

        prevFrameEnergyRef.current = smoothed.total;
      }

      prevFrameDataRef.current = new Uint8ClampedArray(data);
    } catch (err) {
      // Fallback gracefully on frame capture exception.
    }
  }, 60);

  return () => clearInterval(frameInterval);
}, [
  isSessionActive,
  cameraActive,
  isPaused,
  isHardStopped,
  currentBpm,
]);


// Explicit Mode Badge & Camera Toggle Button
<div className="absolute top-3 left-3 flex items-center gap-2">
  <button
    onClick={enableCamera}
    type="button"
    className="px-3 py-1 bg-slate-900/80 hover:bg-slate-800 rounded-full border border-slate-700 text-xs text-blue-300 font-semibold backdrop-blur-md flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
    title={
      cameraActive
        ? "Camera is active - click to re-initialize"
        : "Click to enable camera tracking"
    }
  >
    {cameraActive ? (
      <>
        <Video className="w-3.5 h-3.5 text-emerald-400" />
        <span>Camera Tracking • {currentBpm} BPM</span>
      </>
    ) : (
      <>
        <Camera className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-amber-300">
          Tap to Enable Camera
        </span>
      </>
    )}
  </button>

  {cameraActive && debugLogMsg && (
    <div className="px-2 py-1 bg-slate-900/80 rounded-full border border-slate-700 text-[9px] font-mono text-emerald-400 backdrop-blur-md max-w-[180px] truncate">
      {debugLogMsg}
    </div>
  )}
</div>

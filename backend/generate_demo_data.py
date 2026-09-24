import os
import shutil
import numpy as np
import pandas as pd

def generate_demo_files():
    # Target directories
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_demo_dir = os.path.abspath(
        os.path.join(backend_dir, "..", "frontend", "public", "demo")
    )
    os.makedirs(frontend_demo_dir, exist_ok=True)

    np.random.seed(42)

    # 1. demo_imu_tremor.csv: 30s at 100 Hz, 4.8 Hz tremor + noise + slow drift
    fs_imu = 100.0
    duration_tremor = 30.0
    t_tremor = np.arange(0, duration_tremor, 1.0 / fs_imu)
    
    # 4.8 Hz dominant tremor component
    tremor_4_8hz = 0.65 * np.sin(2 * np.pi * 4.8 * t_tremor)
    slow_drift = 0.3 * np.sin(2 * np.pi * 0.1 * t_tremor)
    noise_ax = np.random.normal(0, 0.08, len(t_tremor))
    
    ax = 9.81 + tremor_4_8hz + slow_drift + noise_ax
    ay = 0.2 * np.cos(2 * np.pi * 4.8 * t_tremor) + np.random.normal(0, 0.05, len(t_tremor))
    az = 0.1 * np.sin(2 * np.pi * 4.8 * t_tremor) + np.random.normal(0, 0.05, len(t_tremor))

    # Gyroscope columns
    gx = 0.4 * np.cos(2 * np.pi * 4.8 * t_tremor) + np.random.normal(0, 0.02, len(t_tremor))
    gy = np.random.normal(0, 0.02, len(t_tremor))
    gz = np.random.normal(0, 0.02, len(t_tremor))

    df_imu_tremor = pd.DataFrame({
        "time": np.round(t_tremor, 4),
        "ax": np.round(ax, 4),
        "ay": np.round(ay, 4),
        "az": np.round(az, 4),
        "gx": np.round(gx, 4),
        "gy": np.round(gy, 4),
        "gz": np.round(gz, 4),
    })

    # 2. demo_imu_short.csv: 5s at 100 Hz (short duration trigger)
    duration_short = 5.01
    t_short = np.arange(0, duration_short, 1.0 / fs_imu)
    ax_short = 9.81 + 0.2 * np.sin(2 * np.pi * 5.0 * t_short) + np.random.normal(0, 0.05, len(t_short))
    ay_short = np.random.normal(0, 0.05, len(t_short))
    az_short = np.random.normal(0, 0.05, len(t_short))
    gx_short = np.random.normal(0, 0.01, len(t_short))
    gy_short = np.random.normal(0, 0.01, len(t_short))
    gz_short = np.random.normal(0, 0.01, len(t_short))

    df_imu_short = pd.DataFrame({
        "time": np.round(t_short, 4),
        "ax": np.round(ax_short, 4),
        "ay": np.round(ay_short, 4),
        "az": np.round(az_short, 4),
        "gx": np.round(gx_short, 4),
        "gy": np.round(gy_short, 4),
        "gz": np.round(gz_short, 4),
    })

    # 3. demo_eeg.csv: 60s at 250 Hz, 4 channels with 10 Hz alpha and 20 Hz beta
    fs_eeg = 250.0
    duration_eeg = 60.0
    t_eeg = np.arange(0, duration_eeg, 1.0 / fs_eeg)

    alpha_wave = 15.0 * np.sin(2 * np.pi * 10.0 * t_eeg)  # 10 Hz Alpha
    beta_wave = 8.0 * np.sin(2 * np.pi * 20.0 * t_eeg)    # 20 Hz Beta
    theta_wave = 4.0 * np.sin(2 * np.pi * 6.0 * t_eeg)    # 6 Hz Theta
    delta_wave = 5.0 * np.sin(2 * np.pi * 2.0 * t_eeg)    # 2 Hz Delta

    ch1 = alpha_wave + beta_wave + theta_wave + delta_wave + np.random.normal(0, 3.0, len(t_eeg))
    ch2 = 1.2 * alpha_wave + 0.8 * beta_wave + theta_wave + np.random.normal(0, 3.0, len(t_eeg))
    ch3 = 0.9 * alpha_wave + 1.1 * beta_wave + delta_wave + np.random.normal(0, 3.0, len(t_eeg))
    ch4 = alpha_wave + beta_wave + np.random.normal(0, 3.0, len(t_eeg))

    df_eeg = pd.DataFrame({
        "time": np.round(t_eeg, 4),
        "ch1": np.round(ch1, 3),
        "ch2": np.round(ch2, 3),
        "ch3": np.round(ch3, 3),
        "ch4": np.round(ch4, 3),
    })

    # Save to backend directory
    path_imu_tremor = os.path.join(backend_dir, "demo_imu_tremor.csv")
    path_imu_short = os.path.join(backend_dir, "demo_imu_short.csv")
    path_eeg = os.path.join(backend_dir, "demo_eeg.csv")

    df_imu_tremor.to_csv(path_imu_tremor, index=False)
    df_imu_short.to_csv(path_imu_short, index=False)
    df_eeg.to_csv(path_eeg, index=False)

    print(f"Generated backend CSV files:\n - {path_imu_tremor}\n - {path_imu_short}\n - {path_eeg}")

    # Copy to /frontend/public/demo
    shutil.copy(path_imu_tremor, os.path.join(frontend_demo_dir, "demo_imu_tremor.csv"))
    shutil.copy(path_imu_short, os.path.join(frontend_demo_dir, "demo_imu_short.csv"))
    shutil.copy(path_eeg, os.path.join(frontend_demo_dir, "demo_eeg.csv"))

    print(f"\nCopied demo files to frontend: {frontend_demo_dir}")

if __name__ == "__main__":
    generate_demo_files()

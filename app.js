// --- Conceptual App Logic (Revised for PEC Flow) ---

let currentSessionId = null;
// ** IMPORTANT: Replace localhost with your actual computer's IP address if testing from phone on same WiFi **
// Find your IP: On Windows open cmd, type `ipconfig`, look for 'IPv4 Address'. On Mac/Linux open terminal, type `ifconfig` or `ip addr`.
// Example: const SERVER_BASE_URL = 'http://192.168.1.100:3000'; // Your IP
const SERVER_BASE_URL = 'http://localhost:3000'; // Use this if app opened on same PC

const placeholderCardData = {
    number: "6274111122223333", // Replace with a VALID test card number format if needed, but still fake
    expiry: "12/28", // Format MM/YY
    cvv: "123",
    name: "MVP User Test" // Optional for PEC, doesn't seem to have a field
};

let html5QrCode = null;
let detectedOtp = null; // Store detected OTP

// --- QR Scanner Functions ---
function onScanSuccess(decodedText, decodedResult) {
    console.log(`Code matched = ${decodedText}`, decodedResult);
    updateAppStatus(`کد اسکن شد: ${decodedText.substring(0, 10)}...\nدرحال اتصال...`); // "Scanned... Linking..."
    stopScanning();
    linkSession(decodedText);
}

function onScanFailure(error) {
    // console.warn(`Code scan error = ${error}`); // Ignore transient errors
}

function startScanning() {
    const qrReaderElement = document.getElementById('qr-reader');
    if (!qrReaderElement) {
        console.error("QR Reader element not found!");
        updateAppStatus("خطا: نمایش اسکنر ممکن نیست."); // "Error: Cannot show scanner"
        return;
    }
    stopScanning(); // Ensure previous instance is stopped

    try {
        html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }; // Experiment with config

        qrReaderElement.style.display = 'block';
        updateAppStatus("درحال اسکن کد QR..."); // "Scanning QR Code..."
        html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
            .catch((err) => {
                console.error("Unable to start scanning.", err);
                updateAppStatus("خطا در شروع اسکنر. دسترسی دوربین را بررسی کنید."); // "Error starting scanner. Check camera permission."
                qrReaderElement.style.display = 'none';
            });
    } catch (e) {
         console.error("Failed to initialize Html5Qrcode", e);
         updateAppStatus("خطا در راه اندازی اسکنر."); // "Error initializing scanner"
    }
}

function stopScanning() {
    const qrReaderElement = document.getElementById('qr-reader');
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then((ignore) => {
            console.log("QR Code scanning stopped.");
             if(qrReaderElement) qrReaderElement.style.display = 'none';
        }).catch((err) => {
            console.error("Failed to stop scanning.", err);
            if(qrReaderElement) qrReaderElement.style.display = 'none'; // Hide anyway
        });
    } else {
         if(qrReaderElement) qrReaderElement.style.display = 'none'; // Hide if not scanning too
    }
}

// --- Link Session ---
async function linkSession(sessionId) {
     console.log(`Attempting to link with session: ${sessionId}`);
     updateAppStatus(`درحال اتصال به ${sessionId.substring(0,6)}...`);
     try {
         const response = await fetch(`${SERVER_BASE_URL}/session/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sessionId, appIdentifier: "MVP_PWA_App_01" })
         });

        if (response.ok) {
            currentSessionId = sessionId;
            console.log("Session linked successfully!");
            updateAppStatus(`متصل شد! برای ارسال اطلاعات کارت کلیک کنید.`);
            document.getElementById('scanButton').disabled = true; // Disable scan after link
            document.getElementById('sendCardButton').disabled = false;
            startOtpSmsListener(); // Start listening conceptually
        } else {
            const errorData = await response.json();
            console.error("Failed to link session:", response.status, errorData.error);
            updateAppStatus(`خطا در اتصال: ${errorData.error || response.statusText}. دوباره اسکن کنید.`); // "Error linking... Scan again."
            document.getElementById('scanButton').disabled = false; // Re-enable scan on error
        }
     } catch(error) {
          console.error("Network or other error during linking:", error);
          updateAppStatus("خطای شبکه هنگام اتصال. دوباره اسکن کنید."); // "Network error... Scan again."
          document.getElementById('scanButton').disabled = false; // Re-enable scan on error
     }
}

// --- Relay Card Data ---
async function relayData(type, payload) {
     if (type !== 'card_data' || !currentSessionId) {
        console.error("Invalid state for relaying card data");
        updateAppStatus("خطا: امکان ارسال اطلاعات کارت وجود ندارد."); // "Error: Cannot send card info"
        return;
     }

    console.log(`Relaying data - Type: ${type}`);
    updateAppStatus(`درحال ارسال اطلاعات کارت...`);
    document.getElementById('sendCardButton').disabled = true; // Prevent double send

    try {
        const response = await fetch(`${SERVER_BASE_URL}/session/relay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: currentSessionId, type, payload })
        });

        if (response.ok) {
            updateAppStatus(`اطلاعات کارت ارسال شد. منتظر دریافت پیامک رمز پویا...`);
            // Keep button disabled, wait for OTP phase
        } else {
            const errorData = await response.json();
            console.error(`Failed to relay ${type}:`, response.status, errorData.error);
            updateAppStatus(`خطا در ارسال اطلاعات کارت: ${errorData.error || response.statusText}`);
            document.getElementById('sendCardButton').disabled = false; // Re-enable on error
        }
    } catch(error) {
        console.error(`Network or other error relaying ${type}:`, error);
        updateAppStatus(`خطای شبکه هنگام ارسال اطلاعات کارت.`); // "Network error sending card info"
        document.getElementById('sendCardButton').disabled = false; // Re-enable on error
    }
}

// --- OTP SMS Listener & Display ---
function startOtpSmsListener() {
    console.log("Conceptual: Starting OTP SMS Listener...");
    // In real Android: Use SMS Retriever API or listen for incoming SMS with READ_SMS
    // For Demo: Enable the simulation button
    const simButton = document.getElementById('simulateOtpArrivalButton');
    if (simButton) {
        simButton.style.display = 'block';
        simButton.disabled = false;
    }
}

function displayDetectedOtp(otp) {
    detectedOtp = otp;
    console.log("OTP Detected (Simulated):", otp);
    const otpDisplayEl = document.getElementById('otpDisplay');
    if (otpDisplayEl) {
        otpDisplayEl.innerHTML = `رمز شناسایی شده: <strong style="font-size: 1.2em; color: black;">${otp}</strong>`; // Highlight OTP
        otpDisplayEl.style.display = 'block';
        updateAppStatus(`رمز پویا شناسایی شد! آن را در صفحه پرداخت رایانه وارد کنید.`);
    }
     const simButton = document.getElementById('simulateOtpArrivalButton');
     if(simButton) simButton.disabled = true; // Disable after one use for demo clarity
}

// --- UI Update Function ---
function updateAppStatus(message) {
    const statusEl = document.getElementById('appStatus');
    if (statusEl) statusEl.textContent = message;
}

// --- Event Listeners ---
document.getElementById('scanButton')?.addEventListener('click', startScanning);

document.getElementById('sendCardButton')?.addEventListener('click', () => {
    console.log("Send Placeholder Card button clicked.");
    relayData('card_data', placeholderCardData);
});

document.getElementById('simulateOtpArrivalButton')?.addEventListener('click', () => {
    const simulatedOtpValue = "123456"; // Demo OTP
    displayDetectedOtp(simulatedOtpValue);
});

// Initial status message
updateAppStatus("برای شروع، کد QR را در رایانه اسکن کنید.");

// Check if library is loaded (optional)
if (typeof Html5Qrcode === 'undefined') {
     console.error("html5-qrcode library not loaded!");
     updateAppStatus("خطا: کتابخانه اسکنر بارگذاری نشده است."); // "Error: Scanner library not loaded"
     document.getElementById('scanButton').disabled = true;
}
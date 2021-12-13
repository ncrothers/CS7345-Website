var hasStarted = false;
var processImages = true;
var filtersToProcess = 0;
var numChannels = 4;
var filterArray = [];
var useWasm = true;

var displayTimingIndex = 0;
var displayTimingLength = 30;
var displayTimingHistory = [];

var dataTiming = [];
var dataTimingIndex = 0;
const dataTimingTotal = 1000;
var isDataTiming = false;

function buildInterface() {
    let processor = new Module.ConvolutionProcessor("filters.txt");
    const numFilters = processor.getNumFilters();

    let options = document.getElementById("options");

    let title = document.createElement("h3");
    title.innerText = "Filters";

    let filtersDiv = document.createElement("div");
    filtersDiv.setAttribute("id", "filters-group")

    filtersDiv.appendChild(title);

    // =====================
    // Add filter checkboxes
    // =====================

    for (let i = 0; i < numFilters; i++) {
        let div = document.createElement("div");
        let checkbox = document.createElement("input");
        let label = document.createElement("label");
        
        const filterName = processor.getFilterName(i);
        
        checkbox.setAttribute("type", "checkbox");
        checkbox.setAttribute("id", filterName+"-filter");
        checkbox.setAttribute("value", ""+i)
        checkbox.addEventListener("change", updateSettings);
        filterArray.push(filterName+"-filter");
        
        label.setAttribute("for", filterName+"-filter");
        label.innerText = filterName;
        
        div.appendChild(checkbox);
        div.appendChild(label);
        
        filtersDiv.appendChild(div);
    }
    
    filtersDiv.appendChild(document.createElement("br"));
    
    options.appendChild(filtersDiv);
    
    let optionsDiv = document.createElement("div");
    optionsDiv.setAttribute("id", "options-group");

    title = document.createElement("h3");
    title.innerText = "Options";
    
    optionsDiv.appendChild(title);
    
    // =====================
    // Add grayscale checkbox
    // =====================

    let div = document.createElement("div");
    let checkbox = document.createElement("input");
    let label = document.createElement("label");
    
    checkbox.setAttribute("type", "checkbox");
    checkbox.setAttribute("id", "grayscale");
    checkbox.setAttribute("value", "grayscale")
    checkbox.addEventListener("change", updateSettings);
    
    label.setAttribute("for", "grayscale");
    label.innerText = "grayscale";
    
    div.appendChild(checkbox);
    div.appendChild(label);
    
    optionsDiv.appendChild(div);

    // =====================
    // Add Wasm checkbox
    // =====================
    
    div = document.createElement("div");
    checkbox = document.createElement("input");
    label = document.createElement("label");
    
    checkbox.setAttribute("type", "checkbox");
    checkbox.setAttribute("id", "wasm");
    checkbox.setAttribute("value", "wasm")
    checkbox.addEventListener("change", updateSettings);
    checkbox.checked = true;
    
    label.setAttribute("for", "wasm");
    label.innerText = "use WASM";
    
    div.appendChild(checkbox);
    div.appendChild(label);
    
    optionsDiv.appendChild(div);

    options.appendChild(optionsDiv);
    
    // =====================
    // Bind Click Event to Record Timing Button
    // =====================
    
    let button = document.getElementById("record-timing");
    button.addEventListener("click", startDataTiming);
}

// ==================================
// Event Listeners
// ==================================

function startDataTiming() {
    let button = document.getElementById("record-timing");
    button.setAttribute("disabled", "true");

    dataTimingIndex = 0;
    dataTiming = [];
    isDataTiming = true;
}

function updateSettings() {
    let newFilters = 0;
    for (let filterName of filterArray) {
        const filter = document.getElementById(filterName);
        if (filter.checked) {
            let index = filter.getAttribute("value");
            newFilters |= 1 << +index;
        }
    }

    filtersToProcess = newFilters;

    const grayscale = document.getElementById("grayscale");

    if (grayscale.checked) {
        numChannels = 1;
    }
    else {
        numChannels = 4;
    }

    useWasm = document.getElementById("wasm").checked;
}

function runProgram() {
    var video = document.querySelector("#videoElement");
    
    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia(
            { video: { 
                width: { ideal: 640 },
                height: { ideal: 480 }  
            }
        })
        .then(function (stream) {
            video.srcObject = stream;
            // Wait until the video stream has started to begin convolutions
            video.addEventListener("canplay", e => {
                if (!hasStarted) {
                    buildInterface();
                    startConvolutions();
                    hasStarted = true;
                }
            });
        })
        .catch(function (e) {
            console.log("Something went wrong!");
        });
    }
}

function addTiming(time) {
    if (displayTimingIndex >= displayTimingLength) {
        displayTimingHistory.shift();
        displayTimingHistory.push(time);
    }
    else {
        displayTimingHistory.push(time);
        displayTimingIndex++;
    }

    if (isDataTiming) {
        if (dataTimingIndex < dataTimingTotal) {
            dataTiming.push(time);
            dataTimingIndex++;
            let progress = document.getElementById("record-progress");
            progress.innerText = Math.round(100*dataTimingIndex/dataTimingTotal) + "%";
        }
        else {
            isDataTiming = false;
            let button = document.getElementById("record-timing");
            button.removeAttribute("disabled");

            let csvContent = "data:text/csv;charset=utf-8,";

            dataTiming.forEach(element => {
                csvContent += element + "\r\n";
            });

            let encodedUri = encodeURI(csvContent);
            window.open(encodedUri);
        }
    }
}

function getTimingAvg() {
    if (displayTimingIndex >= displayTimingLength) {
        let sum = 0;
        for (let t of displayTimingHistory) {
            sum += t;
        }
        return (sum / displayTimingLength).toFixed(2);
    }
    else {
        return "";
    }
}

function startConvolutions() {
    let video = document.querySelector("#videoElement");
    console.log(video.videoWidth, video.videoHeight);

    // WASM Module
    let processor = new Module.ConvolutionProcessor("filters.txt");

    let processorJS = new JS_ConvolutionProcessor();

    let canvas = document.querySelector("#canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const len = canvas.width*canvas.height*4;
    const outputPtr = Module._malloc(len);
    let output = new Uint8ClampedArray(Module.HEAP8.buffer, outputPtr, len);
    
    setInterval(() => {
        if (processImages) {
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const {data, width, height} = imageData;

            // copy data to reserved memory
            output.set(data);
            let start = performance.now();

            if (useWasm) {
                if (numChannels == 1) {
                    processor.imageToGrayscale(outputPtr, len);
                }
                processor.processImage(outputPtr, width, height, numChannels, filtersToProcess);
            }
            else {
                if (numChannels == 1) {
                    processorJS.imageToGrayscale(output, len);
                }
                processorJS.processImage(output, width, height, numChannels, filtersToProcess);
            }

            let end = performance.now();

            addTiming(end-start);
            document.getElementById("timing-avg").innerText = getTimingAvg();

            context.putImageData(new ImageData(output, width, height), 0, 0);
        }
    }, 0);
}



runProgram();
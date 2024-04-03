var numberOfLegosBeforeAutoScales = 50000;
var canvasCropArea = document.getElementById('canvasCropArea'),
    cropCtx = canvasCropArea.getContext('2d'),
    cropRect = {},
    drag = false,
    mouseX,
    mouseY,
    closeEnough = 10,
    dragTL = dragBL = dragTR = dragBR = false;
var zoomAmount = 1;


function init(){
    imgOriginal.src=""
    let imageDataUrl = sessionStorage.getItem('Crop')
    if (!imageDataUrl) imageDataUrl = sessionStorage.getItem('OG')

    if (imageDataUrl){
        imgOriginal.src = imageDataUrl
        console.log('crop src loaded')
        imgOriginal.onload = function () {
            console.log('imgOriginal onload')
 
            LoadLayout()
        }
    } 
}


document.addEventListener('DOMContentLoaded', function () {
    console.log('Crop, dom contentloaded')
    init()
    createSliderZoom();
}, false);

//-----------------------------------------------------------
//Functions
//-----------------------------------------------------------

document.getElementById('file-selector').addEventListener('input', event => {
    showWaitSpinner();
    const file = event.target.files[0];
    if (file == null) return;
    if (!file.type) {
        hideWaitSpinner();
        alert('Error: The File.type property does not appear to be supported on this browser.');
        return;
    }
    if (!file.type.match('image.*')) {
        hideWaitSpinner();
        alert('Error: The selected file does not appear to be an image.');
        return;
    }

    const reader = new FileReader();

    document.getElementById('file-selector').value = "";

    reader.onload = (function (theFile) {
        var image = new Image();
        image.src = theFile.target.result;

        image.onload = function () {
            imgOriginal.src = this.src;
            clearSessionStorage()
            var newprojectId= Date.now().toString()
            sessionStorage.setItem('openedProject',newprojectId)
            console.log('newprojectid',sessionStorage.getItem('openedProject'))
            rescaleIfNeededLegos();
    
        };
    });

    reader.addEventListener('load', event => { });
    reader.readAsDataURL(file);
});

function rescaleIfNeededLegos() {
    if (imgOriginal.naturalWidth * imgOriginal.naturalHeight > numberOfLegosBeforeAutoScales) {
        txtMaxNumLegos.value = numberOfLegosBeforeAutoScales;
        updateScaleNumOFLegos(true);
        scaleLego(numberOfLegosBeforeAutoScales, finishLoadPic);
        txtMaxNumLegos.value = 720;
        updateScaleNumOFLegos(false);
    }
    else
        finishLoadPic()
}

function finishLoadPic() {
    hideWaitSpinner();
    LoadLayout();
    initCropArea();
    imageSaveToServer(imgOriginal, 'OG', "CropPage");
}

function cropAndScaleLegos() {
    if (Number(scaleTotalLegos.innerText) >= Number(lblTotalLegos.innerText)) {
        showInfoModal("Warning - Cannot scale to larger size", "The current image is <strong>" + lblTotalLegos.innerText + "</strong> Legos, and you are trying to scale to <strong>" + scaleTotalLegos.innerText + "</strong>, but you must scale to a smaller number of legos.");
        return;
    }

    if (cropRect.w === undefined)
        scaleLego(txtMaxNumLegos.value, finishScale);
    else
        cropLego();
    sessionStorage.removeItem('Paint')
    sessionStorage.removeItem('Adjust')
}

function finishScale() {
    LoadLayout();
    imageSaveToServer(imgOriginal, 'Crop', "CropPage");
}

function cropLego() {
    var canvasOG = document.createElement("canvas");
    canvasOG.width = imgOriginal.width;
    canvasOG.height = imgOriginal.height;
    var ctxOG = canvasOG.getContext("2d");
    ctxOG.drawImage(imgOriginal, 0, 0);
    var imgData = ctxOG.getImageData(0, 0, imgOriginal.width, imgOriginal.height);

    cropRectOriginal = {
        startX: cropRect.startX / zoomAmount,
        startY: cropRect.startY / zoomAmount,
        w: cropRect.w / zoomAmount,
        h: cropRect.h / zoomAmount
    }

    canvasImage.width = cropRectOriginal.w;
    canvasImage.height = cropRectOriginal.h;
    var ctxCropped = canvasImage.getContext("2d");
    var imgDataCropped = ctxCropped.getImageData(0, 0, cropRectOriginal.w, cropRectOriginal.h);

    var count = 0;
    for (h = cropRectOriginal.startY; h < cropRectOriginal.startY + cropRectOriginal.h; h++) {
        for (w = cropRectOriginal.startX; w < cropRectOriginal.startX + cropRectOriginal.w; w++) {
            var start = (imgOriginal.width * h * 4) + (4 * w);
            imgDataCropped.data[count] = imgData.data[start];
            imgDataCropped.data[count + 1] = imgData.data[start + 1];
            imgDataCropped.data[count + 2] = imgData.data[start + 2];
            imgDataCropped.data[count + 3] = imgData.data[start + 3];
            count = count + 4;
        }
    }

    ctxCropped.putImageData(imgDataCropped, 0, 0);
    imgOriginal.src = canvasImage.toDataURL("image/png");
    initCropArea();

    imgOriginal.onload = function () {
        initCropArea();
        scaleLego(txtMaxNumLegos.value, finishScale);

    };
}

function LoadLayout() {
    canvasImage.width = imgOriginal.width * zoomAmount;
    canvasImage.height = imgOriginal.height * zoomAmount;
    var ctx = canvasImage.getContext("2d");
    ctx.scale(zoomAmount, zoomAmount);
    ctx.drawImage(imgOriginal, 0, 0);
    updateScaleNumOFLegos(false);
    setOGstats();
}



function createSliderZoom() {
    noUiSlider.create(sliderZoom, {
        range: {
            min: -5,
            max: 10
        },
        step: 1,
        start: [1]
    });

    sliderZoom.noUiSlider.on('update', function (value) {
        zoomAmount = value >= 1 ? value : 1 / ((-1 * value) + 2);
        LoadLayout();
        initCropArea();
    });
}


//------CROP Selector STUFF--------
function initCropArea() {
    cropRect = {};
    canvasCropArea.addEventListener('mousedown', mouseDown, false);
    canvasCropArea.addEventListener('mouseup', mouseUp, false);
    canvasCropArea.addEventListener('mousemove', mouseMove, false);
    canvasCropArea.addEventListener('mouseout', mouseUp, false);
    canvasCropArea.width = canvasImage.width;
    canvasCropArea.height = canvasImage.height;
}

function mouseDown(e) {
    var rect = e.target.getBoundingClientRect();
    mouseX = e.pageX - rect.left;
    mouseY = e.pageY - rect.top;

    if (cropRect.w === undefined) {
        cropRect = {
            startX: getNearestSnap(mouseX),
            startY: getNearestSnap(mouseY),
            w: zoomAmount,
            h: zoomAmount
        }
        dragBR = true;
    }
    else if (checkCloseEnough(mouseX, cropRect.startX) && checkCloseEnough(mouseY, cropRect.startY))
        dragTL = true;
    else if (checkCloseEnough(mouseX, cropRect.startX + cropRect.w) && checkCloseEnough(mouseY, cropRect.startY))
        dragTR = true;
    else if (checkCloseEnough(mouseX, cropRect.startX) && checkCloseEnough(mouseY, cropRect.startY + cropRect.h))
        dragBL = true;
    else if (checkCloseEnough(mouseX, cropRect.startX + cropRect.w) && checkCloseEnough(mouseY, cropRect.startY + cropRect.h))
        dragBR = true;

    draw();
}

function checkCloseEnough(p1, p2) {
    return Math.abs(p1 - p2) < closeEnough;
}

function mouseUp() {
    dragTL = dragTR = dragBL = dragBR = false;
}

function mouseMove(e) {
    var rect = e.target.getBoundingClientRect();
    mouseX = e.pageX - rect.left;
    mouseY = e.pageY - rect.top;

    if (checkCloseEnough(mouseX, cropRect.startX) && checkCloseEnough(mouseY, cropRect.startY))
        this.style.cursor = "nwse-resize";
    else if (checkCloseEnough(mouseX, cropRect.startX + cropRect.w) && checkCloseEnough(mouseY, cropRect.startY))
        this.style.cursor = "nesw-resize";
    else if (checkCloseEnough(mouseX, cropRect.startX) && checkCloseEnough(mouseY, cropRect.startY + cropRect.h))
        this.style.cursor = "nesw-resize";
    else if (checkCloseEnough(mouseX, cropRect.startX + cropRect.w) && checkCloseEnough(mouseY, cropRect.startY + cropRect.h))
        this.style.cursor = "nwse-resize";
    else
        this.style.cursor = "default";

    var nearestSnapX = getNearestSnap(mouseX);
    var nearestSnapY = getNearestSnap(mouseY);

    if (dragTL) {
        if (cropRect.startX != nearestSnapX && cropRect.w + cropRect.startX - nearestSnapX >= zoomAmount) {
            cropRect.w += cropRect.startX - nearestSnapX;
            cropRect.startX = nearestSnapX;
        }
        if (cropRect.startY != nearestSnapY && cropRect.h + cropRect.startY - nearestSnapY >= zoomAmount) {
            cropRect.h += cropRect.startY - nearestSnapY;
            cropRect.startY = nearestSnapY;
        }
    } else if (dragTR) {
        if (cropRect.startX != nearestSnapX && nearestSnapX - cropRect.startX >= zoomAmount) {
            cropRect.w = nearestSnapX - cropRect.startX;
        }
        if (cropRect.startY != nearestSnapY && cropRect.h + cropRect.startY - nearestSnapY >= zoomAmount) {
            cropRect.h += cropRect.startY - nearestSnapY;
            cropRect.startY = nearestSnapY;
        }
    } else if (dragBL) {
        if (cropRect.startX != nearestSnapX && cropRect.w + cropRect.startX - nearestSnapX >= zoomAmount) {
            cropRect.w += cropRect.startX - nearestSnapX;
            cropRect.startX = nearestSnapX;
        }
        if (cropRect.startY != nearestSnapY && nearestSnapY - cropRect.startY >= zoomAmount) {
            cropRect.h = nearestSnapY - cropRect.startY;
        }
    } else if (dragBR) {
        if (cropRect.startX != nearestSnapX && nearestSnapX - cropRect.startX >= zoomAmount)
            cropRect.w = nearestSnapX - cropRect.startX;
        if (cropRect.startY != nearestSnapY && nearestSnapY - cropRect.startY >= zoomAmount)
            cropRect.h = nearestSnapY - cropRect.startY;

    }
    if (dragTL || dragTR || dragBL || dragBR) {
        updateScaleNumOFLegos(false);
    }
    draw();
}

function getNearestSnap(x) {
    return Math.ceil(x / zoomAmount) * zoomAmount;
}

function draw() {
    cropCtx.clearRect(0, 0, canvasCropArea.width, canvasCropArea.height);
    cropCtx.fillStyle = "rgba(255, 255, 255,.5)";
    cropCtx.fillRect(cropRect.startX, cropRect.startY, cropRect.w, cropRect.h);
    cropCtx.strokeStyle = "rgb(0, 0, 255)";
    cropCtx.strokeRect(cropRect.startX, cropRect.startY, cropRect.w, cropRect.h);
}

//--------scale----------
function updateScaleNumOFLegos(autoscaled) {
    if (!autoscaled && txtMaxNumLegos.value > 27000) {
        showInfoModal("Warning", "Max value is 3000");
        txtMaxNumLegos.value = 27000;
    }
    if (imgOriginal.width == 0)
        divScaleStatsLegos.style.visibility = "hidden";
    else {
        divScaleStatsLegos.style.visibility = "";
        if (cropRect.w == undefined) {
            var factor = 1.0 / (Math.sqrt( txtMaxNumLegos.value / (imgOriginal.width * imgOriginal.height)));
            var x = imgOriginal.width / factor ;
            var y = imgOriginal.height / factor ;
            setScaleWHLegos(x, y);
        }
        else {
            var factor = 1.0 / (Math.sqrt( txtMaxNumLegos.value / (cropRect.w * cropRect.h)));
            var x = cropRect.w / factor ;
            var y = cropRect.h / factor;
            setScaleWHLegos(x, y);
        }
    }
}

function setScaleWHLegos(x, y) {
    if (Math.round(x) * Math.round(y) <= Number(txtMaxNumLegos.value)) {
        scaleWidthLegos.innerText = Math.round(x);
        scaleHeightLegos.innerText = Math.round(y);
    }
    else if (x % 1 > y % 1) {
        scaleWidthLegos.innerText = Math.floor(y) * Math.round(x) <= Number(txtMaxNumLegos.value) ? Math.round(x) : Math.floor(x);
        scaleHeightLegos.innerText = Math.floor(y);
    }
    else {
        scaleHeightLegos.innerText = Math.floor(x) * Math.round(y) <= Number(txtMaxNumLegos.value) ? Math.round(y) : Math.floor(y);
        scaleWidthLegos.innerText = Math.floor(x);
    }

    scaleTotalLegos.innerText = scaleWidthLegos.innerText * scaleHeightLegos.innerText;
}

function scaleLego(maxNumLegos, callback) {
    var ogWidth = imgOriginal.width;
    var ogHeight = imgOriginal.height;
    var newWidth, newHeight;

    newWidth = Number(scaleWidthLegos.innerText) ;
    newHeight = Number(scaleHeightLegos.innerText);
    var xFactor = ogWidth / newWidth;
    var yFactor = ogHeight / newHeight;

    var canvasOG = document.createElement("canvas");
    canvasOG.width = imgOriginal.width;
    canvasOG.height = imgOriginal.height;
    var ctxOG = canvasOG.getContext("2d");
    ctxOG.drawImage(imgOriginal, 0, 0);
    var imgData = ctxOG.getImageData(0, 0, imgOriginal.width, imgOriginal.height);

    canvasImage.width = newWidth;
    canvasImage.height = newHeight;
    var ctxScaled = canvasImage.getContext("2d");
    var imgDataScaled = ctxScaled.getImageData(0, 0, newWidth, newHeight);

    var count = 0;
    for (var y = 0; y < newHeight; y++) {
        for (var x = 0; x < newWidth; x++) {
            var listRed = [];
            var listGreen = [];
            var listBlue = [];

            for (var xOld = Math.round(x * xFactor); xOld < Math.round((x + 1) * xFactor); xOld++) {
                for (var yOld = Math.round(y * yFactor); yOld < Math.round((y + 1) * yFactor); yOld++) {
                    if (xOld < ogWidth && yOld < ogHeight) {
                        var start = (imgOriginal.width * yOld * 4) + (4 * xOld);
                        if (imgData.data[start + 3] == 0) {
                            listRed.push(255);
                            listGreen.push(255);
                            listBlue.push(255);
                        }
                        else {
                            listRed.push(imgData.data[start]);
                            listGreen.push(imgData.data[start + 1]);
                            listBlue.push(imgData.data[start + 2]);
                        }
                    }
                }
            }

            imgDataScaled.data[count] = Math.round(listRed.reduce((a, b) => a + b, 0) / listRed.length);
            imgDataScaled.data[count + 1] = Math.round(listGreen.reduce((a, b) => a + b, 0) / listGreen.length);
            imgDataScaled.data[count + 2] = Math.round(listBlue.reduce((a, b) => a + b, 0) / listBlue.length);
            imgDataScaled.data[count + 3] = 255;
            count = count + 4;
        }
    }

    ctxScaled.putImageData(imgDataScaled, 0, 0);
    imgOriginal.src = canvasImage.toDataURL("image/png");
    initCropArea();

    imgOriginal.onload = function () {
        callback();
    };
}

function openFromURL() {
    showWaitSpinner();
    var image = new Image();
    image.crossOrigin = "Anonymous";
    image.src = inputOpenFromURL.value;

    image.onload = function () {
        var canvasOG = document.createElement("canvas");
        canvasOG.width = this.width;
        canvasOG.height = this.height;openFrom
        var ctxOG = canvasOG.getContext("2d");
        ctxOG.drawImage(this, 0, 0);

        imgOriginal.src = canvasOG.toDataURL("image/png");

        imgOriginal.onload = function () {
            console.log('image crop file loading')
            clearSessionStorage()
            inputOpenFromURL.value = "";
            var newprojectId= Date.now().toString()
            sessionStorage.setItem('openedProject',newprojectId)
            console.log('newprojectid',sessionStorage.getItem('openedProject'))

            rescaleIfNeededLegos();
   
        }
    };
    image.onerror = function () {
        hideWaitSpinner();
        alert("There was an error attempting to load this image.");
    }
}

function setOGstats() {
    if (imgOriginal.width > 0) {
        lblWidthPixels.innerText = imgOriginal.width;
        lblHeightPixels.innerText = imgOriginal.height;
        lblWidthLegos.innerText = Math.round(imgOriginal.width * 10) / 10;
        lblHeightLegos.innerText = Math.round(imgOriginal.height  * 10) / 10;
        lblTotalLegos.innerText = Math.round(imgOriginal.width  * imgOriginal.height * 10) / 10;
        divOGStats.style.visibility = "visible";
    }
    else
        divOGStats.style.visibility = "hidden";
}
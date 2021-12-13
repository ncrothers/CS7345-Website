/**
 * JavaScript implementation of the ConvolutionProcessor class
 */

const PADDING = 0;

class JS_ConvolutionProcessor {
    constructor() {
        this.loadFilters();
    
        for (let f = 0; f < this.m_numFilters; f++) {
            let filter = this.m_filters[f];
            console.log(filter.getFilterName() + ":");
            for (let row = 0; row < filter.getFilterSize(); row++) {
                for (let col = 0; col < filter.getFilterSize()-1; col++) {
                    console.log(filter.getValue(row, col) + ",");
                }
                console.log(filter.getValue(row, filter.getFilterSize()-1));
            }
        }
    }
    
    getNumFilters() {
        return this.m_numFilters;
    }
    
    getFilterName(index) {
        if (index < 0 || index >= this.m_numFilters) {
            return "invalid index";
        }
    
        return this.m_filters[index].getFilterName();
    }
    
    imageToGrayscale(srcImage, totalLength) {
    
        for (let i = 0; i < totalLength; i += 4) {
            // 0.2126 R + 0.7152 G + 0.0722 B
            let grayscale = 0.2126*srcImage[i] + 0.7152*srcImage[i+1] + 0.0722*srcImage[i+2];
            srcImage[i] = grayscale;
            srcImage[i+1] = grayscale;
            srcImage[i+2] = grayscale;
        }
    }
    
    processImage(image, imageWidth, imageHeight, numChannels, filterNames) {
        let tempImage = new Float32Array(imageWidth*imageHeight*4);
        
        for (let i = 0; i < this.m_numFilters; i++) {
            let mask = 1 << i;
            if ((mask & filterNames) == mask) {
                let filter = this.m_filters[i];
                this.convolve(image, tempImage, imageWidth, imageHeight, numChannels, 0, imageHeight, 0, imageWidth, filter);
            }
        }
    }
    
    convolve(image, tempImage, imageWidth, imageHeight, numChannels, rowStart, rowEnd, colStart, colEnd, filter) {
    
        let numChannelsToProcess = numChannels;
    
        // Set the number of channels to 3 to skip the alpha channel later
        if (numChannels == 4) {
            numChannelsToProcess = 3;
        }
    
        let filterSize = filter.getFilterSize();

        // Used for normalizing, no longer needed but kept for now
        let minPixels = new Array(numChannelsToProcess);
        let maxPixels = new Array(numChannelsToProcess);
    
        for (let i = 0; i < numChannelsToProcess; i++) {
            minPixels[i] = 300;
            maxPixels[i] = -1;
        }
    
        // For every row in the given range
        for (let imageRow = rowStart; imageRow < rowEnd; imageRow++) {
            // For every column in the given range
            for (let imageCol = colStart; imageCol < colEnd; imageCol++) {
                // For each channel in the image
                // 1-4 for multiplication later, not 0-3
                // Skip alpha channel
                for (let c = 0; c < numChannelsToProcess; c++) {
    
                    let sum = 0;
    
                    // For each row in the filter
                    for (let filterRow = 0; filterRow < filterSize; filterRow++) {
                        // Value of the current pixel for the FILTER, not for the image
                        // e.g. for a 3x3 filter, the first value will be -1 (starts 1 row above the current image pixel)
                        let filterRowOffset = -Math.floor(filterSize/2) + filterRow;
    
                        // For each column in the filter
                        for (let filterCol = 0; filterCol < filterSize; filterCol++) {
                            // Same as the filterRowOffset, but for the column
                            let filterColOffset = -Math.floor(filterSize/2) + filterCol;
    
                            // Check if the current filter pixel is outside of the actual image boundary
                            if ((imageRow+filterRowOffset < 0) || (imageRow+filterRowOffset >= imageHeight) ||
                                (imageCol+filterColOffset < 0) || (imageCol+filterColOffset >= imageWidth)) {
                                // Zero padding
                                if (PADDING == 0) {
                                    sum += 0;
                                }
                            }
                            else {
                                let filterValue = filter.getValue(filterRow, filterCol);
                                // Calculating the index for the current filter pixel
                                let pixelValue = image[(imageRow+filterRowOffset)*imageWidth*4 + ((imageCol+filterColOffset)*4 + c)];
                                sum += filterValue * (pixelValue/255);
                            }
                        }
                    }
                    if (sum < minPixels[c]) {
                        minPixels[c] = sum;
                    }
                    if (sum > maxPixels[c]) {
                        maxPixels[c] = sum;
                    }
                    tempImage[imageRow*imageWidth*4 + (imageCol*4 + c)] = sum;
                }
            }
        }
    
        let p = 0;
    
        while (p < imageWidth*imageHeight*4) {
            let channel = 0;
            if (numChannels == 4) {
                channel = p % 4;
                if (channel == 3) {
                    image[p] = 255;
                    p++;
                    continue;
                }
            }
    
            // Old normalizing code
            // let ratio = 1 / (maxPixels[channel]-minPixels[channel]);
            // let newVal = (tempImage[p]-minPixels[channel])*ratio;
            let newVal = tempImage[p];
            if (newVal < 0) newVal = 0;
            if (newVal > 1) newVal = 1;
            image[p] = Math.floor(255*newVal);
    
            if (numChannels == 4) {
                p++;
            }
            else {
                image[p+1] = Math.floor(255*newVal);
                image[p+2] = Math.floor(255*newVal);
                image[p+3] = 255;
                p += 4;
            }
        }
    }
    
    loadFilters() {
        this.m_filters = [];

        for (let filter of filterData) {
            this.m_filters.push(new Filter(filter.name, filter.data, filter.size));
        }

        this.m_numFilters = this.m_filters.length;
    }
};

class Filter {
    // Constructor that takes in filter data as a flattened 2d matrix
    // filterSize corresponds to the width of the filter, not the length of the passed array
    constructor(filterName, filter, filterSize) {
        this.m_filterName = filterName;
        this.m_filterData = filter;
        this.m_filterSize = filterSize;
    }

    getFilter() {
        return this.m_filterData;
    }

    getFilterSize() {
        return this.m_filterSize;
    }

    getFilterName() {
        return this.m_filterName;
    }

    getValue(row, col) {
        if (row >= this.m_filterSize || col >= this.m_filterSize) {
            throw(new RangeError("Filter subscript out of bounds"));
        }
        return this.m_filterData[row*this.m_filterSize + col];
    }
};

// Same data as what's in filters.txt
const filterData = [
    {
        "name": "Sharpen",
        "size": 3,
        "data": [
            0,-1,0,
            -1,5,-1,
            0,-1,0
        ]
    },
    {
        "name": "Gaussian Blur",
        "size": 3,
        "data": [
            0.0625,0.125,0.0625,
            0.125,0.25,0.125,
            0.0625,0.125,0.0625
        ]
    },
    {
        "name": "Gaussian Blur 5x5",
        "size": 5,
        "data": [
            0.003765,0.015019,0.023792,0.015019,0.003765,
            0.015019,0.059912,0.094907,0.059912,0.015019,
            0.023792,0.094907,0.150342,0.094907,0.023792,
            0.015019,0.059912,0.094907,0.059912,0.015019,
            0.003765,0.015019,0.023792,0.015019,0.003765
        ]
    },
    {
        "name": "Vertical Emboss",
        "size": 3,
        "data": [
            0,1,0,
            0,0,0,
            0,-1,0
        ]
    },
    {
        "name": "LoG",
        "size": 3,
        "data": [
            -1,-1,-1,
            -1,8,-1,
            -1,-1,-1
        ]
    },
    {
        "name": "Box Blur",
        "size": 3,
        "data": [
            0.111,0.111,0.111,
            0.111,0.111,0.111,
            0.111,0.111,0.111
        ]
    },
]
var express = require("express");
var multer = require("multer");
var fs = require("fs");
var printer = require("node-thermal-printer");
var sharp = require("sharp");
var floydSteinberg = require('floyd-steinberg');
var PNG = require('pngjs').PNG;


console.log(printer.printerTypes.EPSON);

printer.init({
    type: printer.printerTypes.EPSON,
    interface: "printer:Epson_TM88"
});
printer.isPrinterConnected(function (response) {
    console.log("Printer connected:", response);
});

var app = express();
app.set("view engine", "ejs");

app.get("/", (req, res) => {
    res.render("index");
});

function ditherImage(inputName) {
    fs.createReadStream("./uploads/" + inputName).pipe(new PNG()).on('parsed', function () {
        floydSteinberg(this).pack().pipe(fs.createWriteStream("./uploads/dither" + outputName));
    });
}

function printtheimage(name) {
    var inputName = String(name);
    console.log("InputName: " + inputName);
    if (inputName.match(/(jpeg|jpg)/g) != (0 || null)) {
        outputName = inputName.replace(inputName.match(/(jpeg|jpg)/g)[0], 'png');
    } else {
        outputName = inputName;
    }
    outputName = outputName.replace(outputName.match(/(.jpeg|.jpg|.png)/g)[0], '-resized' + outputName.match(/(.jpeg|.jpg|.png)/g)[0])
    console.log("OutputName: " + outputName);

    sharp("./uploads/" + inputName)
        .resize(400)
        .normalise()
        .greyscale()
        .png()
        // .toFile("./uploads/resized" + filetoprint.replace('.jpeg', '.png')).then(function () {
        .toFile("./uploads/" + outputName).then(function () {
            ditherImage(outputName);
            printer.printImage('uploads/' + outputName, function (done) {
                printer.cut();
                printer.execute(function (err) {
                    if (err) {
                        console.error("Print failed", err);
                    } else {
                        console.log("Print done");
                    }
                });
            });
        });
}

var fileOriginalName;

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        var dir =
            "./uploads";
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        callback(null, dir);
    },
    filename: function (req, file, callback) {
        fileOriginalName = file.originalname;
        callback(null, file.originalname);
    }
});
var upload = multer({
    storage: storage
}).array("files", 12);
app.post("/upload", function (req, res, next) {
    upload(req, res, function (err) {
        if (err) {
            return res.end("Something went wrong:(");
        }
        console.log(fileOriginalName);
        printtheimage(fileOriginalName);
        res.end("Upload completed.");
    });
});

app.listen(5620, function () {
    console.log('printer upload app listening at port 5620');
});
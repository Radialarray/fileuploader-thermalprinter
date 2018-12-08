var express = require("express");
var serveStatic = require('serve-static')
var multer = require("multer");
var fs = require("fs");
var printer = require("node-thermal-printer");
var sharp = require("sharp");
var floydSteinberg = require('floyd-steinberg');
var PNG = require('pngjs').PNG;
var bodyParser = require('body-parser');


console.log(printer.printerTypes.EPSON);

printer.init({
    type: printer.printerTypes.EPSON,
    // interface: "printer:Epson_TM88"
    interface: "printer:EpsonTM88"
});
printer.isPrinterConnected(function (response) {
    console.log("Printer connected:", response);
});

var app = express();
app.set("view engine", "ejs");

app.use(express.static(__dirname + '/public'));

app.get("/", (req, res) => {
    res.render("index");
});

// for parsing application/json
app.use(bodyParser.json());

// for parsing application/xwww-
app.use(bodyParser.urlencoded({
    extended: true
}));
//form-urlencoded

function changeName(param) {
    return new Promise(function (resolve, reject) {
        input = String(param);
        if (input.match(/(jpeg|jpg)/g) != (0 || null)) {
            output = input.replace(input.match(/(jpeg|jpg|JPG|JPEG)/g)[0], 'png');
        } else {
            output = input;
        }
        resized = output.replace(output.match(/(.jpeg|.jpg|.JPG|.JPEG|.png|.PNG)/g)[0], '-resized.png')
        dithered = output.replace(output.match(/(.jpeg|.jpg|.JPG|.JPEG|.png|.PNG)/g)[0], '-dithered.png')
        console.log('naming done')
        var result = {
            input: input,
            resized: resized,
            dithered: dithered
        };
        resolve(result);
    });
}

function convertImage(result) {
    return new Promise(function (resolve, reject) {
        sharp("./uploads/" + result.input)
            .resize(500)
            .normalise()
            .greyscale()
            .png()
            .toFile("./uploads/" + result.resized, function () {
                console.log('converting done')
                resolve(result);
            })
    });
}

function ditherImage(result) {
    return new Promise(function (resolve, reject) {
        fs.createReadStream("./uploads/" + result.resized).pipe(new PNG()).on('parsed', function () {
            floydSteinberg(this).pack().pipe(fs.createWriteStream("./uploads/" + result.dithered)).on('close', function () {
                console.log('dithering done');
                resolve(result);
            });
        });
    });
}

function printImage(result) {
    // return new Promise(function (resolve, reject) {
    printer.printImage('uploads/' + result.dithered, function (done) {
        printer.cut();
        printer.execute(function (err) {
            if (err) {
                console.error("print failed", err);
            } else {
                console.log("printing done");
                console.log("…………………………………………………………………………………………");
            }
        });
    });
    return console.log('________________________');
}

async function printImages(name) {
    let step1 = await changeName(name);
    let step2 = await convertImage(step1);
    let step3 = await ditherImage(step2);
    await printImage(step3);
}

function printText(data) {
    console.log(data)
    if (data.textarea.length > 0) {
        if (data.textarea.length < 50) {
            printer.alignCenter();
            printer.setTextQuadArea();
            printer.bold(true);
        }
        if (data.hasOwnProperty('big')) {
            if (data.big === "on") {
                printer.setTextQuadArea();
                // console.log("yup, big")
            }
        }
        if (data.hasOwnProperty('bold')) {
            if (data.bold === "on") {
                printer.bold(true);
                // console.log("yup, bold")
            }
        }
        if (data.hasOwnProperty('underlined')) {
            if (data.underlined === "on") {
                printer.underlineThick(true);
                // console.log("yup, underlined")
            }
        }
        if (data.hasOwnProperty('invertcolor')) {
            if (data.invertcolor === "on") {
                printer.invert(true);
                // console.log("yup, inverted")
            }
        }

        printer.println(data.textarea); // Append text with new line
        printer.cut();
        printer.execute(function (err) {
            if (err) {
                console.error("print failed", err);
            } else {
                console.log("printing done");
                console.log("…………………………………………………………………………………………");
            }
        });
    }
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
}).array('files[]', 20);

app.post("/upload", upload, function (req, res) {
    req.files.forEach(function (element) {
        printImages(element.filename);
    });
    //   console.log('file: ', req.files);
    res.render("upload");
});

app.post('/form', function (req, res) {
    printText(req.body);
    res.render("upload");

});

app.listen(5620, function () {
    console.log('printer upload app listening at port 5620');
});
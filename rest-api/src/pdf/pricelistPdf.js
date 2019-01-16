const moment = require('moment');
const path = require('path');

const PDFPrinter = require('pdfmake');

const CURRENCY = {
    czk: {en: 'CZK', cz: 'Kč'},
    eur: {en: 'EUR', cz: 'EUR'},
    usd: {en: 'USD', cz: 'USD'},
};

const FONTS = {
    Roboto : {
        normal: path.resolve(__dirname, './fonts/Roboto-Regular.ttf'),
        bold: path.resolve(__dirname, './fonts/Roboto-Medium.ttf'),
        italics: path.resolve(__dirname, './fonts/Roboto-Italic.ttf'),
        bolditalics: path.resolve(__dirname, './fonts/Roboto-MediumItalic.ttf')
    }
};

function pricelistPdf(data, name) {
    const units = data.units ? data.units.reduce((units, unit) => {units[unit._id.toString()] = unit; return units},{}) : {};
    const printer = new PDFPrinter(FONTS);

    const tableBody = [];
    let tableWidths;

    if(data.currency && data.language && data.label) { // Named pricelist
        tableWidths = ['*', 90, 70];
        tableBody.push([
            {text:`${data.language == 'cz' ? 'Název' : 'Name'}`, fillColor: '#444', color: '#fff'},
            {text:`${data.language == 'cz' ? 'Jednotka' : 'Unit'}`, fillColor: '#444', color: '#fff'},
            {text:`${data.language == 'cz' ? `Cena za jednotku` : `Price per unit`}`, alignment: 'right', fillColor: '#444', color: '#fff'}
        ]);

        data.pricelist.forEach(group => {
            tableBody.push([
                {text: `${group.label.cz}`, fillColor: '#ccc', colSpan: 3},
            ]);
            group.items.forEach(item => {
                tableBody.push([
                    {text: `${item.label[data.language]}`},
                    {text: `${units[item.unitId].label[data.language]}`},
                    {text: `${item.clientPrice ? item.clientPrice : item.price[data.currency]} ${CURRENCY[data.currency][data.language]}`, alignment: 'right'},
                ]);
            })
        });
    } else { // General pricelist
        tableWidths = ['*' ,'*' , 70, 45, 45, 45];
        tableBody.push([
            {text:'Name CZ', fillColor: '#444', color: '#fff'},
            {text:'Name EN', fillColor: '#444', color: '#fff'},
            {text:'Unit', fillColor: '#444', color: '#fff'},
            {text:'Price CZK', alignment: 'right', fillColor: '#444', color: '#fff'},
            {text:'Price EUR', alignment: 'right', fillColor: '#444', color: '#fff'},
            {text:'Price USD', alignment: 'right', fillColor: '#444', color: '#fff'}
        ]);
        data.pricelist.forEach(group => {
            tableBody.push([
                {text: `${group.label.cz}`, fillColor: '#ccc'},
                {text: `${group.label.en}`, fillColor: '#ccc'},
                {text: '', fillColor: '#ccc', colSpan: 4}
            ]);
            group.items.forEach(item => {
                tableBody.push([
                    {text: `${item.label.cz}`},
                    {text: `${item.label.en}`},
                    {text: `${units[item.unitId].label.cz}/${units[item.unitId].label.en}`},
                    {text: `${item.price.czk} CZK`, alignment: 'right'},
                    {text: `${item.price.eur} EUR`, alignment: 'right'},
                    {text: `${item.price.usd} USD`, alignment: 'right'}
                ]);
            })
        });
    }

    const docDefinition = {
        info: {
          title: name
        },
        pageSize: 'A4',
        pageOrientation: 'portrait',
        pageMargins: [ 40, 40, 30, 30 ],

        defaultStyle: {
            font: 'Roboto',
            fontSize: 8
        },

        content: [
            {
                columns: [
                    {image: path.resolve(__dirname, './images/upplogo.png'), width: 120},
                    [
                        {text: 'Universal Production Partners, a.s.', alignment: 'right', fontSize: 10, bold: true},
                        {text: 'T: +420 271 722 121', alignment: 'right', fontSize: 8, margin: [0, 1, 0, 0]},
                        {text: 'www.upp.cz', alignment: 'right', fontSize: 8, margin: [0, 1, 0, 0]}
                    ]
                ]
            },
            {
                columns: [
                    {text: `${name}`, margin: [0, 2, 0, 0], fontSize: 15},
                    {text: `Datum: ${moment().format('D.M.YYYY')}`, fontSize: 10, margin: [0, 3, 0, 0], alignment: 'right'}
                ]
            },
            {
                margin: [0, 10, 0, 0],
                table: {
                    headerRows: 1,
                    widths: tableWidths,
                    body: tableBody
                },
                layout: {
                    paddingTop: function (i) { return (i === 0) ?  5 : 3},
                    paddingBottom: function (i) { return (i === 0) ?  5 : 3}
                }
            }
        ],

        footer: function(currentPage, pageCount) { return {text: `${currentPage.toString()}/${pageCount}`, alignment: 'center', fontSize: 10, margin: [0, 2, 0, 0]} },
        header: function(currentPage) {
            if(currentPage > 1) {
                return {
                    columns: [
                        {text: `${name}`, margin: [40, 20, 30, 10], fontSize: 10},
                        {text: `Datum: ${moment().format('D.M.YYYY')}`, fontSize: 10, margin: [40, 20, 30, 10], alignment: 'right'}
                    ]
                }
            } else return '';
        }
    };

        const doc = printer.createPdfKitDocument(docDefinition);
        return doc;
}

module.exports = pricelistPdf;

const moment = require('moment');
const path = require('path');
const Color =  require('color');

const PDFPrinter = require('pdfmake');

const DEFAULT_GROUP_COLOR = '#ccc';
const DEFAULT_ITEM_COLOR = '#fff';
const HEADER_COLOR = '#fff';
const HEADER_BACKGROUND_COLOR = '#444';
const SUBTOTAL_BACKGROUND_COLOR = '#777';

const FONTS = {
    Roboto : {
        normal: path.resolve(__dirname, './fonts/Roboto-Regular.ttf'),
        bold: path.resolve(__dirname, './fonts/Roboto-Medium.ttf'),
        italics: path.resolve(__dirname, './fonts/Roboto-Italic.ttf'),
        bolditalics: path.resolve(__dirname, './fonts/Roboto-MediumItalic.ttf')
    }
};

function budgetPdf(data, name) {
    const partIndex = data.singleOutput ? data.part : null;
    const parts = partIndex !== null ? [data.parts[partIndex]] : data.parts.filter(part => part.active && part.output);
    //if(parts.length === 1) parts[0].label = ''; //No part header on single output

    const multiTotal = parts.length > 1 && data.multiTotal;

    const language = data.language ? data.language : 'cz';
    const currency = data.currency === 'usd' ? 'USD' : data.currency === 'eur' ? 'EUR' : language === 'cz' ? 'Kč' : 'CZK';
    const groupColors = data.pricelist.colors;

    const date = data.date ? moment(data.date).format('D.M.YYYY') : moment().format('D.M.YYYY');

    const printer = new PDFPrinter(FONTS);

    let budgetState = '';
    switch(data.state) {
        case 'CREATED':
            budgetState = language === 'cz' ? 'ODHAD ROZPOČTU' : 'COST ESTIMATE';
            break;
        case 'TEMPORARY':
            budgetState = language === 'cz' ? 'PŘEDBĚŽNÉ VYÚČTOVÁNÍ' : 'TEMPORARY COST';
            break;
        case 'FINAL':
            budgetState = language === 'cz' ? 'FINÁLNÍ VYÚČTOVÁNÍ' : 'FINAL COST';
            break;
        default:
            budgetState = language === 'cz' ? 'ROZPOČET' : 'BUDGET';
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
                    {text: budgetState, margin: [0, 2, 0, 0], fontSize: 12, bold: true}
                ]
            },
            {
                margin: [0, 8, 0, 0],
                columnGap: 10,
                columns: [
                    {
                        width: 300,
                        table: {
                            widths: ['*'],
                            body: [
                                [{text: `${language === 'cz' ? 'Projekt:' : 'Project:'}`, border: [false, false, false, false], fontSize: 8}],
                                [{text: `${data.projectLabel}`, border: [false, false, false, false], fontSize: 14, bold: true}]
                            ]
                        },
                        layout: {
                            paddingTop: function (i) { return (i === 0) ?  4 : 1},
                            paddingBottom: function (i) { return (i === 2) ?  4 : 1},
                            paddingLeft: function (i) { return 0},
                            paddingRight: function(i) {return 0}
                        }
                    },
                    {
                        width: '*',
                        table: {
                            widths: [60, '*'],
                            body: [
                                [
                                    {text: `${language === 'cz' ? 'Klient:' : 'Client:'}`, alignment: 'right', border: [false, false, false, false], fontSize: 8},
                                    {text: `${data.client}`, border: [false, false, false, false], alignment: 'right', bold: true, fonSize: 10}
                                ],
                                [
                                    {text: `${language === 'cz' ? 'Kontakt v UPP:' : 'UPP contact:'}`, alignment: 'right', border: [false, false, false, false], fontSize: 8},
                                    {text: `${data.contact}`, border: [false, false, false, false], alignment: 'right', bold: true, fonSize: 10}
                                ],
                                [
                                    {text: `${language === 'cz' ? 'Datum:' : 'Date:'}`, alignment: 'right', border: [false, false, false, false], fontSize: 8},
                                    {text: `${date}`, border: [false, false, false, false], alignment: 'right', bold: true, fonSize: 10}
                                ]
                            ]
                        },
                        layout: {
                            paddingTop: function (i) { return (i === 0) ?  4 : 1},
                            paddingBottom: function (i) { return (i === 2) ?  4 : 1},
                            paddingLeft: function (i) { return 0},
                            paddingRight: function(i) {return 0}
                        }
                    }
                ],
            }
        ],
        pageBreakBefore: pageBreakBefore,
        footer: (currentPage, pageCount) => {return {id:'page-footer', text: `${currentPage.toString()}/${pageCount}`, alignment: 'center', fontSize: 10, margin: [0, 5, 0, 0]}},
        header: currentPage => {return currentPage === 1 ? '' :
            {
                id:'page-header',
                columns: [
                    {text: '', margin: [40, 20, 30, 10], fontSize: 10, width: '*'},
                    {text: language === 'cz' ? `Datum: ${date}` : `Date: ${date}` , fontSize: 10, margin: [40, 20, 30, 10], alignment: 'right', width: 170}
                ]
            }
        }
    };

    docDefinition.content.push(parts.map(part => getBudgetTable(part, language, currency, data.colorOutput ? groupColors : undefined)));

    if(multiTotal) docDefinition.content.push(getMultiTotal(parts, language, currency));

    docDefinition.content.push([
            {
                id: 'conditions-header',
                text: `${language === 'cz' ? 'Smluvní podmínky:' : 'Contractual Terms and Conditions:'}`
            },
            {
                id: 'conditions-body',
                margin: [0, 2, 0, 0],
                table: {
                    widths: ['*'],
                    body: data.conditions.split('\n').filter(item => item.trim() !== '').map((item, index) => [{id: 'conditions-item-' + index, text: item, fontSize: 8, bold: index === 0}])
                }
            }
        ]);
    try {
        return printer.createPdfKitDocument(docDefinition);
    } catch(e) {console.log(e)}
}

function getColorString(color) {
    if(typeof color === 'string') color = Color(color);
    const rgb = color.rgb();
    let R = rgb.r.toString(16);
    R = R.length === 1 ? `0${R}` : R;
    let G = rgb.g.toString(16);
    G = G.length === 1 ? `0${G}` : G;
    let B = rgb.b.toString(16);
    B = B.length === 1 ? `0${B}` : B;
    return `#${R}${G}${B}`
}

function getMultiTotal(data, language, currency) {
    const tableWidths = ['*' , 60, 75, 50, 60];
    let multiTotalPrice = 0;
    let multiOffer = false;
    let multiOfferPrice = 0;
    let multiLabel = '';
    let multiLabelShow = false;

    data.forEach((part, i) => {
        let partPrice = 0;
        part.items.forEach((item) => {
            const itemPrice = Math.round(100 * item.price * item.numberOfUnits) / 100;
            partPrice += itemPrice;
        });
        multiTotalPrice += partPrice;

        if(part.offer) {
            multiOffer = true;
            multiOfferPrice += part.offer;
        } else multiOfferPrice += partPrice;

        if(part.label) {
            multiLabelShow = true;
            if(multiLabel) {
                multiLabel += `, ${part.label}`;
            } else {
                multiLabel = part.label;
            }
        } else {
            if(multiLabel) {
                multiLabel += `, ${language === 'cz' ? `ČÁST ${i + 1}` : `PART ${i + 1}`}`;
            } else {
                multiLabel = language === 'cz' ? `ČÁST ${i + 1}` : `PART ${i + 1}`;
            }
        }
    });

    const total = [
        {text: `${language === 'cz' ? 'CELKOVÁ CENA' : 'TOTAL PRICE'}:`, alignment: 'right', fillColor: HEADER_BACKGROUND_COLOR, color: HEADER_COLOR, colSpan: 4, border: [true, false, false, true]},'','','',
        {text: `${numberFormat(Math.round(100 * multiTotalPrice) / 100, language, true)} ${currency}`, alignment: 'right', fillColor: HEADER_BACKGROUND_COLOR, color: HEADER_COLOR, border:[false, false, true, true]}
    ];

    const offer = multiOffer ?
        [
            {text: `${language === 'cz' ? 'UPP NABÍDKA' : 'UPP OFFER'}:`, alignment: 'right', fillColor: HEADER_BACKGROUND_COLOR, color: HEADER_COLOR, colSpan: 4, border: [true, false, false, true]},'','','',
            {text: `${numberFormat(multiOfferPrice, language, true)} ${currency}`, alignment: 'right', fillColor: HEADER_BACKGROUND_COLOR, color: HEADER_COLOR, border:[false, false, true, true]}
        ] : null;

    const table = [];

    let topMargin = 8;

    table.push({id: 'multi-budget-label-' + data._id, text: `${language === 'cz' ? 'CELKEM' : 'TOTAL'}${multiLabelShow ? `${language === 'cz' ? ' ZA' : ' FOR' }: ${multiLabel}` : ''}`, bold: true, fontSize: 12, margins: [0, 8, 0, 0]});
    topMargin = 2;

    table.push({
        id: `multi-budget-price${multiOffer ? '-offer' : ''}`,
        margin: [0, topMargin, 0, 16],
        table: {
            widths: tableWidths,
            body: offer ? [total, offer] : [total]
        },
        layout: {
            paddingTop: function (i, node) { return 5},
            paddingBottom: function (i, node) { return  5},
            paddingRight: function(i) {return (i === 1) ? 1 : 4},
            paddingLeft: function(i) {return (i === 2) ? 0 : 4}
        }
    });

    return table;
}

function getBudgetTable(data, language, currency, groupColors) {
    const tableWidths = ['*' , 60, 75, 50, 60];
    const tableBody = [];
    let totalPrice = 0;

    tableBody.push([
        {id: 'table-header-' + data._id, text:`${language === 'cz' ? 'Technologie' : 'Technology'}`, fillColor: HEADER_BACKGROUND_COLOR, color: HEADER_COLOR, border: [true, true, false, true]},
        {text:`${language === 'cz' ? 'Cena' : 'Price'}`, alignment: 'right', fillColor: HEADER_BACKGROUND_COLOR, color: HEADER_COLOR, border: [false, true, false, true]},
        {text:`${language === 'cz' ? `/ jednotka` : `/ unit`}`, fillColor: HEADER_BACKGROUND_COLOR, color: HEADER_COLOR, border: [false, true, false, true]},
        {text:`${language === 'cz' ? `Počet` : `Units`}`, alignment: 'right', fillColor: HEADER_BACKGROUND_COLOR, color: HEADER_COLOR, border: [false, true, false, true]},
        {text:`${language === 'cz' ? `Cena celkem` : `Total price`}`, alignment: 'right', fillColor: HEADER_BACKGROUND_COLOR, color: HEADER_COLOR, border: [false, true, true, true]}
    ]);

    let groupColor = DEFAULT_GROUP_COLOR;
    let itemColor = DEFAULT_ITEM_COLOR;
    let currentGroup = null;
    let subtotal = 0;

    data.items.forEach((item, index) => {
        if(item.isGroup) {
            if(currentGroup && currentGroup.subtotal) {
                tableBody.push([
                    {id: `table-subtotal-${data._id}-${index}`, text: '', colSpan: 3, border: [true, false, false, false]},'','',
                    {text: `${language === 'cz' ? 'Subtotal' : 'Subtotal'}:`, alignment: 'right', fillColor: SUBTOTAL_BACKGROUND_COLOR, color: HEADER_COLOR, border: [true, false, false, true]},
                    {text: `${numberFormat(Math.round(100 * subtotal) / 100, language, true)} ${currency}`, alignment: 'right', fillColor: SUBTOTAL_BACKGROUND_COLOR, color: HEADER_COLOR, border:[false, false, true, true]}
                ]);
                subtotal = 0;
            }
            const baseColor = groupColors ? item.color ? item.color : groupColors && groupColors[item.id] ? groupColors[item.id] : DEFAULT_GROUP_COLOR : DEFAULT_GROUP_COLOR;
            if(baseColor !== DEFAULT_GROUP_COLOR) {
                groupColor = Color(baseColor).lighten(0.25);
                itemColor = Color(baseColor).lighten(0.45);
            } else {
                itemColor = DEFAULT_ITEM_COLOR;
            }
            tableBody.push([{id: `table-group-${data._id}-${index}`, text: item.label ? item.label : ' ', colSpan: 5, alignment: 'center', fillColor: getColorString(groupColor), bold: true, fontSite: 10}]);
            currentGroup = item;
        } else {
            const itemPrice = Math.round(100 * item.price * item.numberOfUnits) / 100;
            totalPrice = totalPrice + itemPrice;
            subtotal = subtotal + (item.price * item.numberOfUnits);
            tableBody.push([
                {id: `table-item-${data._id}-${index}`, text: item.label ? item.label : ' ', fillColor: getColorString(itemColor)},
                {text: `${numberFormat(item.price, language, true)} ${currency}`, alignment: 'right', border: [true, true, false, true], fillColor: getColorString(itemColor)},
                {text: `/ ${item.unit}`, border: [false, true, true, true], fillColor: getColorString(itemColor)},
                {text: `${numberFormat(item.numberOfUnits, language, false)}`, alignment: 'right', fillColor: getColorString(itemColor)},
                {text: `${numberFormat(itemPrice, language, true)} ${currency}`, alignment: 'right', fillColor: getColorString(itemColor)}
            ]);
        }
    });

    if(currentGroup && currentGroup.subtotal) {
        tableBody.push([
            {id: `table-subtotal-${data._id}-00`, text: ' ', colSpan: 3, border: [true, false, false, true]},'','',
            {text: `${language === 'cz' ? 'Subtotal' : 'Subtotal'}:`, alignment: 'right', fillColor: SUBTOTAL_BACKGROUND_COLOR, color: HEADER_COLOR, border: [true, false, false, true]},
            {text: `${numberFormat(Math.round(100 * subtotal) / 100, language, true)} ${currency}`, alignment: 'right', fillColor: SUBTOTAL_BACKGROUND_COLOR, color: HEADER_COLOR, border:[false, false, true, true]}
        ]);
        subtotal = 0;
    }

    const total = [
        {text: `${language === 'cz' ? 'CELKOVÁ CENA' : 'TOTAL PRICE'}:`, alignment: 'right', fillColor: HEADER_BACKGROUND_COLOR, color: HEADER_COLOR, colSpan: 4, border: [true, false, false, true]},'','','',
        {text: `${numberFormat(Math.round(100 * totalPrice) / 100, language, true)} ${currency}`, alignment: 'right', fillColor: HEADER_BACKGROUND_COLOR, color: HEADER_COLOR, border:[false, false, true, true]}
    ];

    const offer = data.offer ?
        [
            {text: `${language === 'cz' ? 'UPP NABÍDKA' : 'UPP OFFER'}:`, alignment: 'right', fillColor: HEADER_BACKGROUND_COLOR, color: HEADER_COLOR, colSpan: 4, border: [true, false, false, true]},'','','',
            {text: `${numberFormat(data.offer, language, true)} ${currency}`, alignment: 'right', fillColor: HEADER_BACKGROUND_COLOR, color: HEADER_COLOR, border:[false, false, true, true]}
        ] : null;

    const table = [];

    let topMargin = 8;
    if(data.label) {
        table.push({id: 'budget-label-' + data._id, text: `${data.label}`, bold: true, fontSize: 12, margins: [0, 8, 0, 0]});
        topMargin = 2;
    }

    table.push({
        id: 'budget-body',
        margin: [0, topMargin, 0, 0],
        table: {
            headerRows: 1,
            widths: tableWidths,
            body: tableBody
        },
        layout: {
            paddingTop: function (i, node) { return 3},
            paddingBottom: function (i, node) { return 3},
            paddingRight: function(i) {return (i === 1) ? 1 : 4},
            paddingLeft: function(i) {return (i === 2) ? 0 : 4}
        }
    });

    table.push({
        id: `budget-price${data.offer ? '-offer' : ''}`,
        margin: [0, 0, 0, 16],
        table: {
            widths: tableWidths,
            body: data.offer ? [total, offer] : [total]
        },
        layout: {
            paddingTop: function (i, node) { return 5},
            paddingBottom: function (i, node) { return  5},
            paddingRight: function(i) {return (i === 1) ? 1 : 4},
            paddingLeft: function(i) {return (i === 2) ? 0 : 4}
        }
    });

    return table;
}

let conditionsOnNewPage = false;

function pageBreakBefore(currentNode, followingNodesOnPage, nodesOnNextPage, previousNodesOnPage) {
    //Conditions - no header alone and no section break
    const conditionsHeaderAlone = currentNode.id === 'conditions-header' && followingNodesOnPage.length > 0 && followingNodesOnPage[0].id === 'page-footer';
    const conditionsHeaderWillBeAlone = currentNode.id === 'conditions-header' && followingNodesOnPage.length > 2 && followingNodesOnPage[1].pageNumbers.length > 1; //[0] = conditions-body, [1] = first section - conditions-item
    if(currentNode.id === 'conditions-header') conditionsOnNewPage = conditionsHeaderAlone || conditionsHeaderWillBeAlone;
    const conditionsSectionBreak = !conditionsOnNewPage && isIdOfClass(currentNode.id, 'conditions-item') && currentNode.pageNumbers.length > 1;

    //Offer - avoid break between Total price and Offer if exist (id=budget-price-offer instead of budget-price)
    const pricesBreak = (currentNode.id === 'budget-price-offer' || currentNode.id === 'multi-budget-price-offer') && currentNode.pageNumbers.length > 1;


    //Budget header alone
    const budgetHeaderAlone = isIdOfClass(currentNode.id, 'budget-label') && !followingNodesOnPage.some(node => node.id && isIdOfClass(node.id, 'table-item')); //at least group + 1 item

    //Budget multi header alone
    const multiBudgetHeaderAlone = isIdOfClass(currentNode.id, 'multi-budget-label') && nodesOnNextPage.some(node => node.id && (node.id === 'multi-budget-price' || node.id === 'multi-budget-price-offer') );

    //Break on group header if subtotal alone or this header alone
    let groupBreak = false;
    if(isIdOfClass(currentNode.id, 'table-group')) {
        let groupClosed = false;
        const groupItemsOnPage = followingNodesOnPage.filter(node => node.id).reduce((out, node) => {
            if(!groupClosed) {
                if (isIdOfClass(node.id, 'table-group') || node.id === 'budget-price' || node.id === 'budget-price-offer') groupClosed = true;
                else if(isIdOfClass(node.id, 'table-item') || isIdOfClass(node.id, 'table-subtotal')) out.push(node);
            }
            return out;
        }, []);
        const groupItemsOnNextPage = nodesOnNextPage.filter(node => node.id).reduce((out, node) => {
            if(!groupClosed) {
                if (isIdOfClass(node.id, 'table-group') || node.id === 'budget-price' || node.id === 'budget-price-offer') groupClosed = true;
                else if(isIdOfClass(node.id, 'table-item') || isIdOfClass(node.id, 'table-subtotal')) out.push(node);
            }
            return out;
        }, []);
        if((groupItemsOnNextPage.length === 1 && isIdOfClass(groupItemsOnNextPage[0].id, 'table-subtotal')) || (groupItemsOnPage.length === 0 && groupItemsOnNextPage.length > 0)) {
            groupBreak = true;
        }
        //console.log(`${currentNode.text} :: ${groupItemsOnPage.length} * ${groupItemsOnNextPage.length}`)
    }

    let testBreak = false;
    /*
    if(currentNode.id === 'table-item') {
        let groupClosed = false;
        const groupItemsOnPage = followingNodesOnPage.filter(node => node.id).reduce((out, node) => {
            if(!groupClosed) {
                if (node.id === 'table-group' || node.id === 'budget-price' || node.id === 'budget-price-offer') groupClosed = true;
                else if(node.id === 'table-item' || node.id === 'table-subtotal') out.push(node);
            }
            return out;
            if(groupItemsOnPage.length > 0 && groupItemsOnPage[0].text === 'ZZZZZ') {

            }
        }, []);
        //testBreak = true;
    }
    */
    return conditionsHeaderAlone || conditionsHeaderWillBeAlone || conditionsSectionBreak || pricesBreak || budgetHeaderAlone || multiBudgetHeaderAlone || groupBreak || testBreak;
}

function numberFormat(value, language, addZero) {
    const rx= /(\d+)(\d{3})/;
    const number = String(value).replace(/\d+/, function(w){
        while(rx.test(w)){
            w = w.replace(rx, '$1 $2');
        }
        return w;
    });
    const ww = number.split('.');
    if(ww.length <= 1) return number;
    else if(ww[1].length === 1 && addZero) ww[1] = `${ww[1]}0`;
    return `${ww[0]}${language === 'cz' ? ',':'.'}${ww[1]}`;
}

function isIdOfClass(id, className) {
    if(!id || !className) return false;
    return id.indexOf(className) === 0;
}

module.exports = budgetPdf;

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// --- Script Yükleyici Hook ---
const useScriptLoader = (scripts) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let loadedCount = 0;
    const total = scripts.length;

    scripts.forEach(src => {
      if (document.querySelector(`script[src="${src}"]`)) {
        loadedCount++;
        if (loadedCount === total) setLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        loadedCount++;
        if (loadedCount === total) setLoaded(true);
      };
      script.onerror = () => setError(`Script yüklenemedi: ${src}`);
      document.head.appendChild(script);
    });
  }, [scripts]);

  return { loaded, error };
};

// --- Yardımcı Bileşenler ---

const Barcode = ({ text }) => {
  const svgRef = useRef(null);
  
  useEffect(() => {
    if (svgRef.current && text && window.JsBarcode) {
      try {
        const barcodeValue = String(text).slice(0, 16); 
        window.JsBarcode(svgRef.current, barcodeValue, {
          format: "CODE128",
          displayValue: true,
          text: barcodeValue,
          textPosition: "bottom",
          fontSize: 12,
          textMargin: 2,
          height: 35,
          width: 1.5,
          margin: 2
        });
      } catch (e) {
        console.error(`JsBarcode hatası: Barkod "${text}" oluşturulamadı.`, e);
      }
    }
  }, [text]);

  return <svg ref={svgRef} className="max-w-full" />;
};

const QRCode = ({ text, size = '25mm' }) => {
  const qrRef = useRef(null);
  
  useEffect(() => {
    if (qrRef.current && text && window.qrcode) {
      qrRef.current.innerHTML = '';
      try {
        const typeNumber = 0; // Otomatik algılama
        const errorCorrectionLevel = 'L';
        const qr = window.qrcode(typeNumber, errorCorrectionLevel);
        qr.addData(String(text));
        qr.make();
        qrRef.current.innerHTML = qr.createSvgTag({ cellSize: 2, margin: 0 });
        const svg = qrRef.current.querySelector('svg');
        if (svg) {
          svg.style.width = '100%';
          svg.style.height = '100%';
          svg.removeAttribute('width');
          svg.removeAttribute('height');
        }
      } catch (e) {
        console.error("QR Code oluşturulamadı:", text, e);
      }
    }
  }, [text]);

  return <div ref={qrRef} style={{ width: size, height: size, margin: 'auto' }} />;
};

// --- Sabitler ve Veriler ---

const templates = {
  system4: { name: "Barkod Şablonu (Sistem) 4'lü", pageWidth: 210, pageHeight: 297, unit: 'mm', labelWidth: 46, labelHeight: 22, marginTop: 13, marginLeft: 7, numCols: 4, numRows: 13, colGap: 3, rowGap: 0 },
  system3: { name: "Barkod Şablonu (Sistem) 3'lü", pageWidth: 210, pageHeight: 297, unit: 'mm', labelWidth: 69, labelHeight: 25, marginTop: 10, marginLeft: 1.5, numCols: 3, numRows: 11, colGap: 0, rowGap: 0 },
  spine_system: { name: "Sırt Etiketi (Sistem - 52x30mm)", pageWidth: 210, pageHeight: 297, unit: 'mm', labelWidth: 52, labelHeight: 30, marginTop: 0, marginLeft: 20, numCols: 4, numRows: 10, colGap: 0, rowGap: 0 },
  spine_sample: { name: "Sırt Etiketi (Örnek 30x50mm)", pageWidth: 210, pageHeight: 297, unit: 'mm', labelWidth: 30, labelHeight: 50, marginTop: 10, marginLeft: 10, numCols: 6, numRows: 5, colGap: 3, rowGap: 3 },
  custom: { name: 'Özel Ayarlar', pageWidth: 210, pageHeight: 297, unit: 'mm', labelWidth: 46, labelHeight: 22, marginTop: 13, marginLeft: 7, numCols: 4, numRows: 13, colGap: 3, rowGap: 0 },
};

// Kullanıcının isteğine göre güncellenen alan listesi
const availableFields = [ 
  { key: 'itemcallnumber', label: 'Yer Numarası' }, 
  { key: 'title', label: 'Başlık' }, 
  { key: 'isbn', label: 'ISBN/ISSN' }, 
  { key: 'author', label: 'Yazar' }, 
  { key: 'homebranch_description', label: 'Ana Kütüphane' }, 
  { key: 'location', label: 'Raf Konumu' },
  { key: 'raf_kontrol_notu', label: 'Raf Kontrol Notu' }
];

const deweyCategories = { 
  '': 'Yer Numarasına Göre Seç...', 
  '0': '000 - Genel Konular', 
  '1': '100 - Felsefe & Psikoloji', 
  '2': '200 - Din', 
  '3': '300 - Toplum Bilimleri', 
  '4': '400 - Dil ve Dil Bilim', 
  '5': '500 - Doğa Bilimleri & Matematik', 
  '6': '600 - Teknoloji', 
  '7': '700 - Sanat', 
  '8': '800 - Edebiyat', 
  '9': '900 - Coğrafya & Tarih' 
};

const settingLabels = {
  pageWidth: 'Sayfa Genişliği',
  pageHeight: 'Sayfa Yüksekliği',
  labelWidth: 'Etiket Genişliği',
  labelHeight: 'Etiket Yüksekliği',
  marginTop: 'Üst Boşluk',
  marginLeft: 'Sol Boşluk',
  numCols: 'Sütun Sayısı',
  numRows: 'Satır Sayısı',
  colGap: 'Sütun Aralığı',
  rowGap: 'Satır Aralığı'
};

// --- Ana Uygulama ---

function App() {
  // 1. Bağımlılıkları Yükle
  const { loaded, error } = useScriptLoader([
    "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"
  ]);

  // 2. State Tanımları
  const [allData, setAllData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedBarcodes, setSelectedBarcodes] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [settings, setSettings] = useState(templates.system4);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('system4');
  const [sortConfig, setSortConfig] = useState({ key: 'barcode', direction: 'ascending' });
  const [pdfFileName, setPdfFileName] = useState('etiketler');
  
  // Tasarım State'leri
  const [labelType, setLabelType] = useState('barcode'); // 'barcode' | 'spine'
  const [labelFields, setLabelFields] = useState(['itemcallnumber', 'title']);
  const [textAlign, setTextAlign] = useState('center'); 
  const [fontSize, setFontSize] = useState(8);
  const [logo, setLogo] = useState('https://i.ibb.co/XrrDKnNW/ktblogo400.png');
  const [useMinistryLogo, setUseMinistryLogo] = useState(true);
  const [logoSize, setLogoSize] = useState(7);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [customTemplates, setCustomTemplates] = useState({});
  const [newTemplateName, setNewTemplateName] = useState("");
  const [startBarcode, setStartBarcode] = useState("");
  const [endBarcode, setEndBarcode] = useState("");
  const [barcodeFormat, setBarcodeFormat] = useState('CODE128');
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [isFirstLineBold, setIsFirstLineBold] = useState(true);
  const [customText, setCustomText] = useState("");

  // Sırt Etiketi Ekstra Ayarlar
  const [showSpineBarcode, setShowSpineBarcode] = useState(false);
  const [spineBarcodePosition, setSpineBarcodePosition] = useState('bottom'); // 'top' | 'bottom'

  // Tablo başlıklarını güncellenen CSV formatına göre ayarladık
  const tableHeaders = [ 
    { key: 'barcode', label: 'Barkod' }, 
    { key: 'title', label: 'Eser Adı' }, 
    { key: 'author', label: 'Yazar' }, 
    { key: 'itemcallnumber', label: 'Yer Numarası' }, 
    { key: 'isbn', label: 'ISBN/ISSN' },
    { key: 'location', label: 'Raf Konumu' }
  ];
  
  const itemsPerPage = useMemo(() => Math.max(1, settings.numCols * settings.numRows), [settings.numCols, settings.numRows]);

  // 3. Effects (Yan Etkiler)
  useEffect(() => { 
    document.documentElement.classList.toggle('dark', isDarkMode); 
  }, [isDarkMode]);

  useEffect(() => {
      if (labelType === 'spine') {
          setTextAlign('center');
          setFontSize(12); 
      } else {
          setTextAlign('left');
          setFontSize(8);
      }
  }, [labelType]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('kohaLabelMaker_customTemplates');
      if (saved) setCustomTemplates(JSON.parse(saved));
    } catch (e) { console.error("Özel şablonlar yüklenemedi", e); }
    
    try {
      const savedSelection = sessionStorage.getItem('kohaLabelMaker_selectedBarcodes');
      if (savedSelection) setSelectedBarcodes(new Set(JSON.parse(savedSelection)));
    } catch(e) { console.error("Seçimler yüklenemedi", e); }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem('kohaLabelMaker_selectedBarcodes', JSON.stringify(Array.from(selectedBarcodes)));
    } catch (e) { console.error("Seçimler kaydedilemedi", e); }
  }, [selectedBarcodes]);

  // 4. Türetilmiş Veriler (Memoization)
  const labelsToPrint = useMemo(() => 
    allData.filter(item => selectedBarcodes.has(item.barcode)).sort((a, b) => a.barcode.localeCompare(b.barcode)), 
  [allData, selectedBarcodes]);

  const filteredData = useMemo(() => 
    allData.filter(item => Object.values(item).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))), 
  [allData, searchTerm]);

  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key] || ''; 
        const valB = b[sortConfig.key] || '';
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortConfig.direction === 'ascending' 
            ? valA.localeCompare(valB, undefined, {numeric: true}) 
            : valB.localeCompare(valA, undefined, {numeric: true});
        }
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const paginatedData = useMemo(() => { 
    const startIndex = (currentPage - 1) * itemsPerPage; 
    return sortedData.slice(startIndex, startIndex + itemsPerPage); 
  }, [sortedData, currentPage, itemsPerPage]);

  const uniqueLocations = useMemo(() => 
    Array.from(new Set(allData.map(item => item.location).filter(Boolean))).sort(), 
  [allData]);

  // 5. İşleyiciler (Handlers)
  const handlePrintAsPdf = useCallback(() => {
    const printArea = document.getElementById('print-area');
    if (!window.jspdf || !window.html2canvas) {
        alert("PDF kütüphaneleri henüz yüklenmedi. Lütfen sayfayı yenileyin veya biraz bekleyin.");
        return;
    }
    
    const { jsPDF } = window.jspdf;
    if (printArea) {
      window.html2canvas(printArea, { scale: 3, useCORS: true, logging: false }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        
        const baseFileName = pdfFileName.trim() || 'etiketler';
        const dt = new Date();
        const dateTimeString = `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}_${String(dt.getHours()).padStart(2,'0')}${String(dt.getMinutes()).padStart(2,'0')}`;
        pdf.save(`${baseFileName}_${dateTimeString}.pdf`);
      }).catch(err => {
        console.error("PDF oluşturma hatası:", err);
        alert("PDF oluşturulurken bir hata oluştu. Detaylar konsolda.");
      });
    }
  }, [pdfFileName]);

  const updateSelection = (barcodesToUpdate, shouldSelect) => { 
    setSelectedBarcodes(prev => { 
      const newSet = new Set(prev); 
      barcodesToUpdate.forEach(b => { 
        if (shouldSelect) newSet.add(b); 
        else newSet.delete(b); 
      }); 
      return newSet; 
    }); 
  };

  const handleSelectAllFiltered = useCallback(() => updateSelection(filteredData.map(item => item.barcode), true), [filteredData]);
  const handleDeselectAllFiltered = useCallback(() => updateSelection(filteredData.map(item => item.barcode), false), [filteredData]);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'p') { e.preventDefault(); handlePrintAsPdf(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'a') { e.preventDefault(); handleSelectAllFiltered(); }
      if (e.key === 'Escape') { e.preventDefault(); handleDeselectAllFiltered(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrintAsPdf, handleSelectAllFiltered, handleDeselectAllFiltered]);

  const handleFileChange = (event) => {
    const file = event.target.files[0]; if (!file) return;
    setFileName(file.name); setErrorMessage(''); setAllData([]); setSelectedBarcodes(new Set());
    
    const processData = (data) => { 
        // CSV başlıklarını normalize et (boşlukları temizle)
        const normalizedData = data.map(row => {
            const newRow = {};
            Object.keys(row).forEach(key => {
                newRow[key.trim()] = row[key]; // " Eser Adı " -> "Eser Adı"
            });
            return newRow;
        });

        // CSV alanlarını uygulama içindeki alanlara eşle
        const mappedData = normalizedData.filter(row => row['Barkod']).map(row => ({
            ...row,
            barcode: String(row['Barkod']).trim(),
            title: row['Eser Adı'] ? String(row['Eser Adı']) : '',
            author: row['Yazar'] ? String(row['Yazar']) : '',
            itemcallnumber: row['Yer numarası'] ? String(row['Yer numarası']) : '',
            isbn: row['ISBN/ISSN'] ? String(row['ISBN/ISSN']) : '',
            homebranch_description: row['Ana kütüphane'] ? String(row['Ana kütüphane']) : '',
            location: row['Raf konumu'] ? String(row['Raf konumu']) : '',
            raf_kontrol_notu: row['Raf Kontrol Notu'] ? String(row['Raf Kontrol Notu']) : '',
            itemtype: row['Materyal türü'] ? String(row['Materyal türü']) : ''
        }));

        if (mappedData.length > 0) { 
            setAllData(mappedData); 
        } else { 
            setErrorMessage('Dosyada "Barkod" sütunu bulunamadı. Lütfen geçerli bir dosya yükleyin.'); 
        } 
    };

    if (file.name.endsWith('.csv')) { 
        if(window.Papa) {
            window.Papa.parse(file, { header: true, skipEmptyLines: true, complete: res => processData(res.data), encoding: "UTF-8" }); 
        } else {
            alert("CSV işleyici (PapaParse) henüz yüklenmedi.");
        }
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        if(window.XLSX) {
            const reader = new FileReader();
            reader.onload = (e) => { 
                const wb = window.XLSX.read(e.target.result, { type: 'binary' }); 
                processData(window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])); 
            };
            reader.readAsBinaryString(file);
        } else {
            alert("Excel işleyici (SheetJS) henüz yüklenmedi.");
        }
    } else { 
        setErrorMessage('Desteklenmeyen dosya türü. Lütfen .csv veya .xlsx dosyası yükleyin.'); 
    }
  };
  
  const handleFieldSelection = (e) => {
    const { value, checked } = e.target;
    setLabelFields(prev => {
        if (checked) { return prev.length < 3 ? [...prev, value] : prev; } 
        else { return prev.filter(field => field !== value); }
    });
  };

  const handleSelectByRange = () => {
    if (!startBarcode || !endBarcode) { alert("Lütfen başlangıç ve bitiş barkodlarını girin."); return; }
    const barcodesToSelect = allData.filter(item => item.barcode.localeCompare(startBarcode) >= 0 && item.barcode.localeCompare(endBarcode) <= 0).map(item => item.barcode);
    updateSelection(barcodesToSelect, true);
    alert(`${barcodesToSelect.length} adet materyal seçildi.`);
  };
  
  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) { alert("Lütfen şablon için bir isim girin."); return; }
    const newTemplates = { ...customTemplates, [newTemplateName]: settings };
    setCustomTemplates(newTemplates);
    localStorage.setItem('kohaLabelMaker_customTemplates', JSON.stringify(newTemplates));
    setNewTemplateName('');
  };

  const handleDeleteTemplate = (templateName) => {
    const newTemplates = { ...customTemplates };
    delete newTemplates[templateName];
    setCustomTemplates(newTemplates);
    localStorage.setItem('kohaLabelMaker_customTemplates', JSON.stringify(newTemplates));
  };
  
  const loadTemplate = (key) => { 
      setSelectedTemplateKey(key); 
      if (key !== 'custom' && key !== 'load_custom') {
          const tmpl = templates[key] || customTemplates[key];
          if(tmpl) setSettings(tmpl);
      }
  };

  const handleSettingChange = (field, value) => { 
      const newSettings = { ...settings, [field]: Number(value) }; 
      setSettings(newSettings); 
      setSelectedTemplateKey('custom'); 
      templates.custom = { ...templates.custom, ...newSettings }; 
  };

  const requestSort = (key) => { 
      setSortConfig(c => ({ key, direction: c.key === key && c.direction === 'ascending' ? 'descending' : 'ascending' })); 
      setCurrentPage(1); 
  };
  
  const handleSelectPage = () => updateSelection(paginatedData.map(item => item.barcode), true);
  const handleDeselectPage = () => updateSelection(paginatedData.map(item => item.barcode), false);
  
  const handleLocationSelect = (e) => { 
      const loc = e.target.value; 
      if (!loc) return; 
      updateSelection(allData.filter(i => i.location === loc).map(i => i.barcode), true); 
      e.target.value = ''; 
  };
  
  const handleDeweySelect = (e) => { 
      const prefix = e.target.value; 
      if (!prefix) return; 
      updateSelection(allData.filter(i => i.itemcallnumber && String(i.itemcallnumber).startsWith(prefix)).map(i => i.barcode), true); 
      e.target.value = ''; 
  };
  
  const handleLogoChange = (e) => { 
      const file = e.target.files[0]; 
      if (file) { 
          const reader = new FileReader(); 
          reader.onload = (ev) => { setLogo(ev.target.result); setUseMinistryLogo(false); }; 
          reader.readAsDataURL(file); 
      }
  };
  
  const handleMinistryLogoToggle = (e) => { 
      setUseMinistryLogo(e.target.checked); 
      setLogo(e.target.checked ? 'https://i.ibb.co/XrrDKnNW/ktblogo400.png' : null); 
  };

  // 6. Render Yardımcıları
  const renderSingleLabel = (data, key) => {
    // --- SIRT ETİKETİ (SPINE LABEL) RENDER MANTIĞI ---
    if (labelType === 'spine') {
      const callNumber = data.itemcallnumber || (key === 'preview' ? '398.27 GRİ 2005' : '');
      const parts = callNumber.split(' ').filter(p => p && p.trim().length > 0);
      
      // Barkod Formatlama Mantığı (OTOMATİK: İlk 4 hane atla, sonraki 0'ları temizle)
      let barcodeDisplay = null;
      if (showSpineBarcode) {
          let bCode = data.barcode || (key === 'preview' ? '111000000072' : '');
          
          // 1. İlk 4 haneyi atla
          if (bCode.length > 4) {
              bCode = bCode.substring(4);
          } else {
              // 4 haneden kısaysa dokunma veya boşalt (Burada olduğu gibi bırakıyoruz)
          }

          // 2. Baştaki sıfırları temizle (Regex ile string başındaki 0'ları sil)
          bCode = bCode.replace(/^0+/, '');
          
          if(bCode) barcodeDisplay = `[${bCode}]`;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full w-full overflow-hidden" 
             style={{ 
               fontFamily: fontFamily, 
               fontSize: `${fontSize}pt`, 
               lineHeight: 1.2,
               textAlign: textAlign,
               padding: '2mm'
             }}>
            {spineBarcodePosition === 'top' && barcodeDisplay && (
                <div className="mb-1 font-mono text-xs font-bold">{barcodeDisplay}</div>
            )}

            {parts.length > 0 ? parts.map((part, index) => (
              <div key={index} className="font-bold w-full break-words leading-tight">
                {part}
              </div>
            )) : (
              <div className="text-slate-300 text-xs italic">Yer No Yok</div>
            )}
            
            {spineBarcodePosition === 'bottom' && barcodeDisplay && (
                <div className="mt-1 font-mono text-xs font-bold">{barcodeDisplay}</div>
            )}
        </div>
      );
    }

    // --- BARKOD ETİKETİ (BARCODE LABEL) RENDER MANTIĞI ---
    return (
      <div className="flex flex-col text-black h-full box-border overflow-hidden relative">
          <div className="flex items-start flex-grow overflow-hidden" style={{ paddingTop: '1mm', paddingLeft: '1mm', paddingRight: '1mm' }}>
              {logo && (
                  <img 
                      src={logo} 
                      alt="logo" 
                      className="flex-shrink-0 object-contain" 
                      style={{ height: `${logoSize}mm`, width: 'auto', marginRight: '2mm' }} 
                  />
              )}
              <div className="flex-grow overflow-hidden" style={{ textAlign: textAlign, fontSize: `${fontSize}pt`, lineHeight: '1.2', fontFamily: fontFamily }}>
                  {labelFields.map((fieldKey, index) => {
                      const content = fieldKey === 'customText' 
                          ? customText 
                          : (data?.[fieldKey] || ''); 

                      if (!content && key !== 'preview') return null; 

                      return (
                          <span key={`${fieldKey}-${index}`} className={`max-w-full block ${index === 0 && isFirstLineBold ? 'font-bold' : ''}`} style={{wordBreak: 'break-word'}}>
                              {content || (key === 'preview' ? `[${fieldKey}]` : '')}
                          </span>
                      );
                  })}
              </div>
          </div>
          <div className="mt-auto flex-shrink-0 w-full flex justify-center items-end" style={{ padding: '0 1mm 1mm 1mm' }}>
              {barcodeFormat === 'CODE128' 
                  ? <Barcode text={data?.barcode || '123456789012'} /> 
                  : <QRCode text={data?.barcode || '123456789012'} size={`${Math.min(settings.labelWidth * 0.8, settings.labelHeight * 0.6)}mm`} />
              }
          </div>
      </div>
    );
  };

  const renderLabels = () => {
    const totalSlots = settings.numCols * settings.numRows;
    return Array.from({ length: totalSlots }).map((_, i) => (
        <div key={`label-${i}`} className="border border-dashed border-gray-300 overflow-hidden box-border bg-white" style={{ height: '100%' }}>
            {labelsToPrint[i] ? renderSingleLabel(labelsToPrint[i], i) : null}
        </div>
    ));
  };
  
  if (!loaded) {
      return (
          <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
              <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Uygulama Hazırlanıyor...</h2>
                  <p>Gerekli kütüphaneler yükleniyor.</p>
                  {error && <p className="text-red-500 mt-4">{error}</p>}
                  <div className="mt-4 animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
          </div>
      );
  }

  return (
    <>
      <style>{`
        .no-print { display: block; } 
        #print-area { display: block; } 
        @media print { 
            body * { visibility: hidden; } 
            .no-print { display: none; } 
            #print-area, #print-area * { visibility: visible; } 
            #print-area { position: absolute; left: 0; top: 0; width: 100% !important; height: 100% !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; transform: none !important; } 
        }
      `}</style>
      <div className="bg-slate-100 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-200 font-sans p-4 sm:p-6 lg:p-8 transition-colors duration-200">
        <div className="max-w-screen-2xl mx-auto">
           <header className="mb-8 no-print flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Kütüphane Etiket Oluşturucu</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Koha veya Excel verilerini yükleyin, barkod veya sırt etiketlerini tasarlayın.</p>
                </div>
                <button onClick={() => setIsDarkMode(p => !p)} className="p-3 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors shadow-sm">
                    {isDarkMode ? '☀️ Açık Mod' : '🌙 Koyu Mod'}
                </button>
            </header>
          
          <div className="flex flex-col gap-8">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm no-print border border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-lg border-b pb-3 mb-4 dark:border-slate-600 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs px-2 py-1 rounded-full">Adım 1</span>
                    Veri Dosyası Yükle
                </h3>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <label className="block w-full">
                        <span className="sr-only">Dosya Seç</span>
                        <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300 cursor-pointer"/>
                    </label>
                </div>
                {fileName && <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-3 font-medium">✓ Yüklendi: {fileName} ({allData.length} kayıt)</p>}
                {errorMessage && <p className="text-sm text-red-500 mt-3 font-medium">⚠️ {errorMessage}</p>}
            </div>

            {allData.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm no-print border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center border-b pb-3 mb-4 dark:border-slate-600">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs px-2 py-1 rounded-full">Adım 2</span>
                        Materyal Seçimi <span className="text-sm font-normal text-slate-500 ml-2">({selectedBarcodes.size} adet seçildi)</span>
                    </h3>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg">
                        <h4 className="font-semibold text-sm mb-3 text-slate-700 dark:text-slate-300">Barkod Aralığına Göre Seç</h4>
                        <div className="flex items-center gap-2">
                           <input type="text" placeholder="Başlangıç (Örn: 001)" value={startBarcode} onChange={e => setStartBarcode(e.target.value)} className="w-full p-2 border rounded-md text-sm dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none" />
                           <span className="text-slate-400">-</span>
                           <input type="text" placeholder="Bitiş (Örn: 050)" value={endBarcode} onChange={e => setEndBarcode(e.target.value)} className="w-full p-2 border rounded-md text-sm dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none" />
                           <button onClick={handleSelectByRange} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors">Seç</button>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg">
                        <h4 className="font-semibold text-sm mb-3 text-slate-700 dark:text-slate-300">Gruplara Göre Hızlı Seç</h4>
                        <div className="flex items-center gap-3">
                           <select defaultValue="" onChange={handleLocationSelect} className="w-full p-2 border rounded-md text-sm bg-white dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none" disabled={uniqueLocations.length === 0}>
                                <option value="">Kütüphane Bölümü...</option>
                                {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                           </select>
                           <select defaultValue="" onChange={handleDeweySelect} className="w-full p-2 border rounded-md text-sm bg-white dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="">Dewey Sınıflaması...</option>
                                {Object.entries(deweyCategories).map(([key, value]) => key && <option key={key} value={key}>{value}</option>)}
                           </select>
                        </div>
                    </div>
                </div>

                 <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-4 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                   <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-blue-800 dark:text-blue-300 mr-2">TOPLU İŞLEMLER:</span>
                       <button onClick={handleSelectAllFiltered} className="px-3 py-1.5 bg-white border border-blue-200 rounded text-sm text-blue-700 hover:bg-blue-50 dark:bg-slate-800 dark:border-slate-600 dark:text-blue-300 dark:hover:bg-slate-700 transition-colors">Listelenenleri Seç</button>
                       <button onClick={handleDeselectAllFiltered} className="px-3 py-1.5 bg-white border border-red-200 rounded text-sm text-red-600 hover:bg-red-50 dark:bg-slate-800 dark:border-slate-600 dark:text-red-400 dark:hover:bg-slate-700 transition-colors">Seçimi Kaldır</button>
                   </div>
                   <div className="flex items-center gap-2">
                       <button onClick={handleSelectPage} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">Bu Sayfayı Seç</button>
                       <button onClick={handleDeselectPage} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">Bu Sayfayı Kaldır</button>
                   </div>
                </div>

                <div className="relative mb-3">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                    <input type="text" placeholder="Başlık, yazar, barkod veya yer numarası ara..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-9 p-2.5 border rounded-md text-sm shadow-sm dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                <div className="overflow-x-auto border rounded-lg dark:border-slate-700">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 font-semibold">
                                {['', ...tableHeaders].map((header, idx) => (
                                    <th key={idx} className="p-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 select-none transition-colors" onClick={() => idx > 0 && requestSort(header.key)}>
                                        <div className="flex items-center gap-1">
                                            {header.label || ''}
                                            {idx > 0 && sortConfig.key === header.key && <span className="text-blue-500">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {paginatedData.map(item => (
                                <tr key={item.barcode} className={`hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${selectedBarcodes.has(item.barcode) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                    <td className="p-3 w-10">
                                        <input type="checkbox" checked={selectedBarcodes.has(item.barcode)} onChange={(e) => updateSelection([item.barcode], e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-500 cursor-pointer"/>
                                    </td>
                                    {tableHeaders.map(header => (
                                        <td key={`${item.barcode}-${header.key}`} className={`p-3 ${header.key === 'barcode' ? 'font-mono text-slate-600 dark:text-slate-400' : ''} ${header.key === 'title' ? 'font-medium text-slate-900 dark:text-white' : ''}`}>
                                            {item[header.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {paginatedData.length === 0 && (
                                <tr><td colSpan={tableHeaders.length + 1} className="p-8 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                <div className="flex justify-between items-center mt-4 text-sm">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:hover:bg-slate-700 transition-colors">« Önceki</button>
                    <span className="font-medium text-slate-600 dark:text-slate-400">Sayfa {currentPage} / {Math.max(1, Math.ceil(sortedData.length / itemsPerPage))}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(sortedData.length / itemsPerPage), p + 1))} disabled={currentPage * itemsPerPage >= sortedData.length} className="px-4 py-2 border rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:hover:bg-slate-700 transition-colors">Sonraki »</button>
                </div>
            </div>
            )}
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm no-print border border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-lg border-b pb-3 mb-4 dark:border-slate-600 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs px-2 py-1 rounded-full">Adım 3</span>
                    Etiket ve Baskı Ayarları
                </h3>
                
                <div className="mb-6 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
                    <h4 className="font-semibold text-sm mb-3 text-indigo-900 dark:text-indigo-300">Etiket Türü Seçimi</h4>
                    <div className="flex gap-4">
                        <label className={`flex-1 cursor-pointer p-3 rounded-lg border-2 transition-all text-center ${labelType === 'barcode' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 hover:border-blue-300 bg-white dark:bg-slate-800 dark:border-slate-600'}`}>
                            <input type="radio" name="labelType" value="barcode" checked={labelType === 'barcode'} onChange={() => setLabelType('barcode')} className="sr-only" />
                            <div className="font-bold text-sm">Barkod Etiketi</div>
                            <div className="text-xs text-slate-500 mt-1">Barkod, başlık ve yazar içerir.</div>
                        </label>
                        <label className={`flex-1 cursor-pointer p-3 rounded-lg border-2 transition-all text-center ${labelType === 'spine' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 hover:border-blue-300 bg-white dark:bg-slate-800 dark:border-slate-600'}`}>
                            <input type="radio" name="labelType" value="spine" checked={labelType === 'spine'} onChange={() => setLabelType('spine')} className="sr-only" />
                            <div className="font-bold text-sm">Sırt Etiketi</div>
                            <div className="text-xs text-slate-500 mt-1">Sadece yer numarası alt alta yazılır.</div>
                        </label>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        {/* BARKOD MODU AYARLARI */}
                        {labelType === 'barcode' && (
                        <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg">
                            <h4 className="font-semibold text-sm mb-3 flex justify-between">
                                Etiket Üzerindeki Bilgiler
                                <span className="text-xs font-normal text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border dark:border-slate-600">Max 3 satır</span>
                            </h4>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              {availableFields.map(field => ( 
                                  <label key={field.key} className={`flex items-center space-x-2 text-sm p-2 rounded border transition-all cursor-pointer ${labelFields.includes(field.key) ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'border-transparent hover:bg-white dark:hover:bg-slate-600'}`}>
                                      <input type="checkbox" value={field.key} checked={labelFields.includes(field.key)} onChange={handleFieldSelection} disabled={!labelFields.includes(field.key) && labelFields.length >= 3} className="rounded text-blue-600 focus:ring-blue-500"/>
                                      <span className="truncate">{field.label}</span>
                                  </label>
                              ))}
                              
                              <div className="col-span-2 mt-2 pt-3 border-t dark:border-slate-600">
                                  <label className="flex items-center space-x-2 text-sm cursor-pointer mb-2">
                                      <input type="checkbox" value="customText" checked={labelFields.includes('customText')} onChange={handleFieldSelection} disabled={!labelFields.includes('customText') && labelFields.length >= 3} className="rounded text-blue-600 focus:ring-blue-500"/>
                                      <span className="font-medium">Sabit Metin Ekle</span>
                                  </label>
                                  {labelFields.includes('customText') && (
                                      <input type="text" value={customText} onChange={e => setCustomText(e.target.value)} placeholder="Örn: Kütüphane Adı" className="w-full p-2 border rounded-md text-sm dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"/>
                                  )}
                              </div>
                            </div>
                        </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-semibold text-sm mb-3">Yazı Stili</h4>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs font-medium block mb-1 text-slate-500">Hizalama</label>
                                            <select value={textAlign} onChange={(e) => setTextAlign(e.target.value)} className="w-full p-2 border rounded-md text-sm dark:bg-slate-700 dark:border-slate-600"><option value="left">Sola</option><option value="center">Orta</option><option value="right">Sağa</option></select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium block mb-1 text-slate-500">Boyut (pt)</label>
                                            <input type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full p-2 border rounded-md text-sm dark:bg-slate-700 dark:border-slate-600"/>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs font-medium block mb-1 text-slate-500">Font</label>
                                            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="w-full p-2 border rounded-md text-sm dark:bg-slate-700 dark:border-slate-600"><option value="sans-serif">Sans-Serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option></select>
                                        </div>
                                        {labelType === 'barcode' && (
                                        <div>
                                            <label className="text-xs font-medium block mb-1 text-slate-500">Barkod Tipi</label>
                                            <select value={barcodeFormat} onChange={(e) => setBarcodeFormat(e.target.value)} className="w-full p-2 border rounded-md text-sm dark:bg-slate-700 dark:border-slate-600"><option value="CODE128">Barkod (128)</option><option value="QR">QR Kod</option></select>
                                        </div>
                                        )}
                                    </div>
                                    {labelType === 'barcode' && (
                                    <label className="flex items-center space-x-2 text-sm cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded">
                                        <input type="checkbox" checked={isFirstLineBold} onChange={e => setIsFirstLineBold(e.target.checked)} className="rounded text-blue-600"/>
                                        <span>İlk satırı kalın yap (Başlık/Yer No)</span>
                                    </label>
                                    )}
                                </div>
                            </div>
                            
                            {labelType === 'barcode' && (
                            <div>
                                <h4 className="font-semibold text-sm mb-3">Logo Ayarları</h4>
                                <div className="p-3 border rounded-lg dark:border-slate-600">
                                    <div className="flex items-center space-x-2 text-sm mb-3">
                                        <input type="checkbox" id="ministryLogoCheck" checked={useMinistryLogo} onChange={handleMinistryLogoToggle} className="rounded text-blue-600"/>
                                        <label htmlFor="ministryLogoCheck" className="cursor-pointer select-none">Varsayılan Logo</label>
                                    </div>
                                    <div className="space-y-3">
                                        {!useMinistryLogo && (
                                            <div>
                                                <label className="text-xs font-medium block mb-1 text-slate-500">Özel Logo Yükle</label>
                                                <input type="file" accept="image/*" onChange={handleLogoChange} className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"/>
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-xs font-medium block mb-1 text-slate-500">Logo Yüksekliği (mm)</label>
                                            <input type="number" value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} className="w-full p-2 border rounded-md text-sm dark:bg-slate-700 dark:border-slate-600"/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            )}
                            
                            {labelType === 'spine' && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-100 dark:border-yellow-800">
                                    <h4 className="font-semibold text-sm mb-3 text-yellow-800 dark:text-yellow-300">Sırt Etiketi Ayarları</h4>
                                    <div className="space-y-3">
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={showSpineBarcode} onChange={e => setShowSpineBarcode(e.target.checked)} className="rounded text-blue-600"/>
                                            <span>Barkod numarasını göster</span>
                                        </label>
                                        
                                        {showSpineBarcode && (
                                            <>
                                                <div className="grid grid-cols-1 gap-2">
                                                    <div>
                                                        <label className="text-xs font-medium block mb-1 text-slate-500">Konum</label>
                                                        <select value={spineBarcodePosition} onChange={e => setSpineBarcodePosition(e.target.value)} className="w-full p-1.5 border rounded text-sm dark:bg-slate-700 dark:border-slate-600">
                                                            <option value="top">Üstte</option>
                                                            <option value="bottom">Altta</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-slate-500">Otomatik: İlk 4 hane atlanır, kalan kısımdaki baştaki sıfırlar silinir. (Örn: 11100000072 -{'>'} [72])</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col">
                        <h4 className="font-semibold text-sm mb-4 text-center text-slate-500 uppercase tracking-wider">Canlı Önizleme</h4>
                        <div className="flex-grow flex items-center justify-center overflow-hidden py-8 bg-slate-200 dark:bg-slate-800 rounded-lg inner-shadow">
                            <div style={{ transform: 'scale(1.5)', transformOrigin: 'center' }}>
                                <div className="bg-white shadow-lg transition-all duration-300" style={{ width: `${settings.labelWidth}mm`, height: `${settings.labelHeight}mm` }}>
                                    {renderSingleLabel({
                                        barcode: '111000000072', // Örnek barkod güncellendi
                                        title: 'Örnek Kitap Adı',
                                        author: 'Yazar Adı',
                                        itemcallnumber: '398.27 GRİ 2005',
                                        location: 'Genel Koleksiyon'
                                    }, 'preview')}
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-center mt-4 text-slate-400">Gerçek baskıda kenar çizgileri kesikli olacaktır.</p>
                    </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-8 mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <div>
                        <h4 className="font-semibold text-sm mb-3">Kağıt Düzeni</h4>
                        <select value={selectedTemplateKey} onChange={(e) => loadTemplate(e.target.value)} className="w-full p-2.5 border rounded-md text-sm mb-4 bg-white dark:bg-slate-700 dark:border-slate-600 shadow-sm">
                            <option value="system4">Barkod: A4 - 4 Sütunlu (46x22mm)</option>
                            <option value="system3">Barkod: A4 - 3 Sütunlu (69x25mm)</option>
                            <option value="spine_system">Sırt Etiketi: Sistem (52x30mm)</option>
                            <option value="spine_sample">Sırt Etiketi: Örnek (30x50mm)</option>
                            <option value="custom">Özel Ayarlar...</option>
                            {Object.keys(customTemplates).length > 0 && <option value="load_custom" disabled>--- Kayıtlı Şablonlar ---</option>}
                            {Object.keys(customTemplates).map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        
                        {selectedTemplateKey === 'custom' && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm bg-slate-50 dark:bg-slate-700/30 p-3 rounded border dark:border-slate-600">
                                {Object.keys(settings).filter(k => k !== 'name' && k !== 'unit').map(key => (
                                    <label key={key} className="flex flex-col">
                                        <span className="text-xs text-slate-500 mb-1">{settingLabels[key] || key} (mm)</span>
                                        <input type="number" value={settings[key]} onChange={e=>handleSettingChange(key, e.target.value)} className="p-1.5 border rounded dark:bg-slate-700 dark:border-slate-600 text-sm"/>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                     <div>
                        <h4 className="font-semibold text-sm mb-3">Şablon Yönetimi</h4>
                         <div className="flex items-center gap-2 mb-4">
                            <input type="text" placeholder="Şablon adı (Örn: Brother 62mm)" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} className="flex-grow p-2.5 border rounded-md text-sm dark:bg-slate-700 dark:border-slate-600" />
                            <button onClick={handleSaveTemplate} className="px-4 py-2.5 border rounded-md text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 transition-colors font-medium">Kaydet</button>
                        </div>
                        
                        <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-600 p-3 max-h-40 overflow-y-auto">
                            <h5 className="text-xs font-bold text-slate-400 uppercase mb-2">Kayıtlı Şablonlar</h5>
                            {Object.keys(customTemplates).length > 0 ? (
                                <div className="space-y-1">
                                    {Object.keys(customTemplates).map(name => (
                                        <div key={name} className="flex justify-between items-center text-sm p-2 bg-white dark:bg-slate-800 rounded border dark:border-slate-600 shadow-sm group">
                                            <span className="font-medium">{name}</span>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => loadTemplate(name)} className="text-xs mr-3 text-blue-600 hover:underline">Yükle</button>
                                                <button onClick={() => handleDeleteTemplate(name)} className="text-xs text-red-600 hover:underline">Sil</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 italic text-center py-2">Henüz kaydedilmiş özel şablon yok.</p>
                            )}
                        </div>
                    </div>
                </div>
             </div>

            <div className="w-full flex flex-col gap-6 pb-20">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm no-print border border-slate-200 dark:border-slate-700 sticky top-4 z-10">
                     <div className="flex flex-col md:flex-row items-end gap-4">
                        <div className="flex-grow w-full">
                            <label className="text-sm font-medium block mb-1 text-slate-600 dark:text-slate-400">PDF Dosya Adı</label>
                            <div className="flex items-center">
                                <input type="text" value={pdfFileName} onChange={(e) => setPdfFileName(e.target.value)} className="w-full p-3 border rounded-l-lg text-sm dark:bg-slate-700 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="etiketler"/>
                                <span className="bg-slate-100 dark:bg-slate-600 border border-l-0 dark:border-slate-600 p-3 rounded-r-lg text-sm text-slate-500">.pdf</span>
                            </div>
                        </div>
                        <button 
                            onClick={handlePrintAsPdf} 
                            className="w-full md:w-auto bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap" 
                            disabled={labelsToPrint.length === 0}
                        >
                            <span>PDF Olarak İndir</span>
                            <span className="bg-blue-500 px-2 py-0.5 rounded text-xs">{labelsToPrint.length} Etiket</span>
                        </button>
                        <button 
                            onClick={() => { if(confirm('Tüm seçimleri temizlemek istediğinize emin misiniz?')) setSelectedBarcodes(new Set()); }} 
                            className="w-full md:w-auto bg-white text-red-600 border border-red-200 font-semibold py-3 px-6 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50" 
                            disabled={selectedBarcodes.size === 0}
                        >
                            Temizle
                        </button>
                    </div>
                </div>
                
                <main className="w-full overflow-auto bg-slate-200 dark:bg-slate-900/50 p-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex justify-center">
                  <div 
                    id="print-area" 
                    className="bg-white shadow-2xl mx-auto" 
                    style={{ 
                        width: `${settings.pageWidth}${settings.unit}`, 
                        height: `${settings.pageHeight}${settings.unit}`, 
                        position: 'relative',
                        boxSizing: 'border-box' 
                    }}
                  >
                    <div 
                        className="grid p-0 m-0" 
                        style={{ 
                            width: '100%', 
                            height: '100%', 
                            paddingTop: `${settings.marginTop}${settings.unit}`, 
                            paddingLeft: `${settings.marginLeft}${settings.unit}`, 
                            gridTemplateColumns: `repeat(${settings.numCols}, ${settings.labelWidth}${settings.unit})`, 
                            gridTemplateRows: `repeat(${settings.numRows}, ${settings.labelHeight}${settings.unit})`, 
                            columnGap: `${settings.colGap}${settings.unit}`, 
                            rowGap: `${settings.rowGap}${settings.unit}` 
                        }}
                    >
                      {renderLabels()}
                    </div>
                  </div>
                </main>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;

import { jsPDF } from "jspdf";

export const generatePDF = async ({ config, blueprint, storyImages, storyContent }) => {
  try {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a5' });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const margin = 15;
    const printWidth = width - (margin * 2);

    doc.setFont("times", "normal");

    const centerText = (txt, y, size = 12, weight = "normal") => {
      doc.setFont("times", weight);
      doc.setFontSize(size);
      const txtW = doc.getStringUnitWidth(txt) * size / doc.internal.scaleFactor;
      doc.text(txt, (width - txtW) / 2, y);
    };

    // --- Cover Page ---
    doc.setFillColor(10, 10, 10); 
    doc.rect(0, 0, width, height, 'F');
    doc.setTextColor(255, 255, 255);

    if (storyImages.cover) {
      try {
        const imgSize = 100;
        const x = (width - imgSize)/2;
        doc.addImage(storyImages.cover, 'PNG', x, 50, imgSize, imgSize);
      } catch(e) {
        console.warn("PDF Cover Image Error", e);
      }
    }

    centerText((config.title || "Untitled Story").toUpperCase(), 35, 22, "bold");
    centerText(config.author || "AI Author", 170, 14, "italic");
    
    // --- Chapters ---
    blueprint.chapters.forEach((chap, i) => {
      doc.addPage();
      doc.setTextColor(0,0,0); 
      doc.setFillColor(255,255,255); 
      
      let y = margin;

      if (storyImages[i]) {
        try {
          const imgH = 80;
          doc.addImage(storyImages[i], 'PNG', margin, y, printWidth, imgH);
          y += imgH + 10;
        } catch(e) {
           console.warn("PDF Chapter Image Error", e);
        }
      } else {
        y += 10;
      }

      doc.setFontSize(24);
      doc.setFont("times", "bold");
      doc.text((i+1).toString(), margin, y);
      
      doc.setFontSize(16);
      doc.text(chap.title, margin + 15, y);
      y += 15;

      doc.setFontSize(11);
      doc.setFont("times", "normal");
      const raw = storyContent[i] || "";
      
      // Enhanced Typesetting: Split by paragraphs for proper spacing
      const paragraphs = raw.split(/\n\n+/);
      
      paragraphs.forEach(para => {
         // Remove basic markdown symbols for cleaner PDF text
         const clean = para.replace(/[*_`]/g, ''); 
         const lines = doc.splitTextToSize(clean, printWidth);
         
         // Check if paragraph fits, else add page
         if (y + (lines.length * 5) > height - margin) {
            doc.addPage();
            y = margin;
         }
         
         lines.forEach(line => {
            if (y > height - margin) {
              doc.addPage();
              y = margin;
            }
            doc.text(line, margin, y);
            y += 5; 
         });
         y += 4; // Typesetting: Extra space between paragraphs
      });
    });

    const fname = `${(config.title || "story").replace(/[^a-z0-9]/gi, '_').substring(0,20)}.pdf`;
    try {
        doc.save(fname);
    } catch (e) {
        window.open(doc.output('bloburl'), '_blank');
    }

    return true;
  } catch (err) {
    throw new Error("PDF Generation failed: " + err.message);
  }
};

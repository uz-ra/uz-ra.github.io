document.addEventListener('DOMContentLoaded', () => {
    // あなたのGoogle Spreadsheetの公開CSVのURLをここに設定します
    const SPREADSHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR0tcO4_TBJ6FNjiDuTEYUY3-lFN_kzJNq99_TStSqvU3jO4bmPBKYug0ggX9yB9qpjoB3U8N-KKqlp/pub?gid=467961282&single=true&output=csv'; 
    const comparisonContainer = document.getElementById('lens-comparison-container');

    async function fetchLensData() {
        try {
            const response = await fetch(SPREADSHEET_CSV_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text(); // CSVデータをテキストとして取得

            const lenses = parseCSV(csvText); // CSVをパースする関数を呼び出し
            
            return lenses;

        } catch (error) {
            console.error('Error fetching or parsing CSV data:', error);
            comparisonContainer.innerHTML = '<p>レンズデータの取得に失敗しました。しばらくしてから再度お試しください。</p>';
            return [];
        }
    }

    // シンプルなCSVパーサー関数 (前回の回答で提供済み)
    function parseCSV(csvString) {
        const lines = csvString.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',');
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const obj = {};
            headers.forEach((header, index) => {
                obj[header.trim()] = values[index] ? values[index].trim() : '';
            });
            data.push(obj);
        }
        return data;
    }

    // createComparisonTable関数 (前回の回答で提供済み)
    function createComparisonTable(lenses) {
        if (lenses.length === 0) {
            comparisonContainer.innerHTML = '<p>表示するレンズデータがありません。</p>';
            return;
        }

        comparisonContainer.style.setProperty('--lens-count', lenses.length);

        const headerRow = document.createElement('div');
        headerRow.classList.add('header-row');
        headerRow.innerHTML = '<div class="header-cell">項目</div>'; 

        lenses.forEach(lens => {
            const headerCell = document.createElement('div');
            headerCell.classList.add('header-cell');
            headerCell.innerHTML = `
                <img src="${lens['画像URL'] || 'placeholder.png'}" alt="${lens['レンズ名']}" class="lens-image">
                <div class="lens-name">${lens['レンズ名']}</div>
                <div>${lens['メーカー']}</div>
            `;
            headerRow.appendChild(headerCell);
        });
        comparisonContainer.appendChild(headerRow);

        const specsToCompare = [
            'メーカー',
            'マウント',
            '焦点距離',
            '開放F値',
            '最短撮影距離',
            '最大撮影倍率',
            'フィルター径',
            '質量',
            'レンズ構成',
            '絞り羽根枚数',
            '価格(参考)', 
            '発売日',
            '特徴・説明'
        ];

        specsToCompare.forEach(specName => {
            const dataRow = document.createElement('div');
            dataRow.classList.add('data-row');

            const specNameCell = document.createElement('div');
            specNameCell.classList.add('data-cell');
            specNameCell.textContent = specName;
            dataRow.appendChild(specNameCell);

            lenses.forEach(lens => {
                const dataCell = document.createElement('div');
                dataCell.classList.add('data-cell');
                dataCell.textContent = lens[specName] || '-'; 
                dataRow.appendChild(dataCell);
            });
            comparisonContainer.appendChild(dataRow);
        });
    }

    fetchLensData().then(lenses => {
        createComparisonTable(lenses);
    });
});
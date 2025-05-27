document.addEventListener('DOMContentLoaded', () => {
    const SPREADSHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR0tcO4_TBJ6FNjiDuTEYUY3-lFN_kzJNq99_TStSqvU3jO4bmPBKYug0ggX9yB9qpjoB3U8N-KKqlp/pub?gid=467961282&single=true&output=csv'; 
    const comparisonContainer = document.getElementById('lens-comparison-container');
    const mountFilter = document.getElementById('mount-filter');
    const focalLengthFilter = document.getElementById('focal-length-filter');
    const compareLensSelect = document.getElementById('compare-lens-select');
    const compareButton = document.getElementById('compare-button');
    const resetButton = document.getElementById('reset-button');

    let allLenses = []; // 全レンズデータを保持する配列
    let filteredLenses = []; // 絞り込み後のレンズデータを保持する配列

    async function fetchLensData() {
        try {
            const response = await fetch(SPREADSHEET_CSV_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();
            allLenses = parseCSV(csvText); // 全レンズデータを取得
            filteredLenses = [...allLenses]; // 最初は全て表示

            populateFilters(); // フィルターのオプションを生成
            populateCompareSelect(allLenses); // 比較選択肢を生成
            createComparisonTable(filteredLenses); // 初期表示

        } catch (error) {
            console.error('Error fetching or parsing CSV data:', error);
            comparisonContainer.innerHTML = '<p>レンズデータの取得に失敗しました。しばらくしてから再度お試しください。</p>';
            return [];
        }
    }

    function parseCSV(csvString) {
        const lines = csvString.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(h => h.trim()); // ヘッダーをトリム
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length !== headers.length) { // データとヘッダーの列数が合わない行はスキップ
                console.warn(`Skipping malformed row: ${lines[i]}`);
                continue;
            }
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] ? values[index].trim() : '';
            });
            data.push(obj);
        }
        return data;
    }

    // フィルターオプションの生成
    function populateFilters() {
        // マウントフィルター
        const mounts = [...new Set(allLenses.map(lens => lens['マウント']))].sort();
        mountFilter.innerHTML = '<option value="">すべて</option>';
        mounts.forEach(mount => {
            if (mount) { // 空の値を避ける
                const option = document.createElement('option');
                option.value = mount;
                option.textContent = mount;
                mountFilter.appendChild(option);
            }
        });

        // 焦点距離フィルター
        const focalLengths = [...new Set(allLenses.map(lens => lens['焦点距離']))].sort((a, b) => {
            // 数値的にソート（例: "24mm"と"50mm"を正しくソート）
            const numA = parseFloat(a);
            const numB = parseFloat(b);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.localeCompare(b); // それ以外は文字列としてソート
        });
        focalLengthFilter.innerHTML = '<option value="">すべて</option>';
        focalLengths.forEach(fl => {
            if (fl) {
                const option = document.createElement('option');
                option.value = fl;
                option.textContent = fl;
                focalLengthFilter.appendChild(option);
            }
        });
    }

    // 比較選択プルダウンのオプションを生成
    function populateCompareSelect(lensesToDisplay) {
        compareLensSelect.innerHTML = ''; // クリア
        lensesToDisplay.forEach(lens => {
            const option = document.createElement('option');
            option.value = lens['レンズ名']; // レンズ名をvalueとして使用
            option.textContent = `${lens['メーカー']} ${lens['レンズ名']}`;
            compareLensSelect.appendChild(option);
        });
    }

    // フィルター適用時の処理
    function applyFilters() {
        const selectedMount = mountFilter.value;
        const selectedFocalLength = focalLengthFilter.value;

        filteredLenses = allLenses.filter(lens => {
            const matchMount = selectedMount === '' || lens['マウント'] === selectedMount;
            const matchFocalLength = selectedFocalLength === '' || lens['焦点距離'] === selectedFocalLength;
            return matchMount && matchFocalLength;
        });

        populateCompareSelect(filteredLenses); // フィルター結果で比較選択肢を更新
        createComparisonTable(filteredLenses); // フィルター結果を表示
    }

    // 比較ボタンクリック時の処理
    function handleCompare() {
        const selectedLensNames = Array.from(compareLensSelect.selectedOptions).map(option => option.value);
        if (selectedLensNames.length < 2) {
            alert('比較するには2つ以上のレンズを選択してください。');
            return;
        }

        const lensesToCompare = allLenses.filter(lens => selectedLensNames.includes(lens['レンズ名']));
        createComparisonTable(lensesToCompare);
    }

    // リセットボタンクリック時の処理
    function handleReset() {
        mountFilter.value = '';
        focalLengthFilter.value = '';
        compareLensSelect.selectedIndex = -1; // 選択を解除
        filteredLenses = [...allLenses];
        populateCompareSelect(allLenses);
        createComparisonTable(allLenses);
    }


    function createComparisonTable(lenses) {
        // ... (既存のcreateComparisonTable関数の冒頭部分) ...

        comparisonContainer.innerHTML = ''; 

        if (lenses.length === 0) {
            comparisonContainer.innerHTML = '<p>表示するレンズデータがありません。</p>';
            return;
        }

        comparisonContainer.style.setProperty('--lens-count', lenses.length);

        // ヘッダー行の生成 (PC表示時のみ有効)
        const headerRow = document.createElement('div');
        headerRow.classList.add('header-row');
        headerRow.innerHTML = '<div class="header-cell fixed-column">項目</div>'; 

        lenses.forEach(lens => {
            const headerCell = document.createElement('div');
            headerCell.classList.add('header-cell');
            headerCell.innerHTML = `
                <img src="${lens['画像URL'] || 'placeholder.png'}" alt="${lens['レンズ名']}" class="lens-image">
                <div class="lens-name">${lens['レンズ名']}</div>
                <div>${lens['メーカー']}</div>
                <a href="${lens['製品ページURL'] || '#'}" target="_blank" class="product-link">製品ページへ</a>
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

        // ここからループ開始
        specsToCompare.forEach(specName => {
            const dataRow = document.createElement('div');
            dataRow.classList.add('data-row');

            // 項目名セル (PC表示時のみ有効)
            const specNameCell = document.createElement('div');
            specNameCell.classList.add('data-cell', 'fixed-column');
            specNameCell.textContent = specName;
            dataRow.appendChild(specNameCell);

            lenses.forEach(lens => {
                const dataCell = document.createElement('div');
                dataCell.classList.add('data-cell');
                // スマホ表示用にdata-label属性を追加
                dataCell.setAttribute('data-label', specName + ':'); 
                dataCell.textContent = lens[specName] || '-'; 
                dataRow.appendChild(dataCell);
            });
            comparisonContainer.appendChild(dataRow);
        });
    }


    // イベントリスナーの設定
    mountFilter.addEventListener('change', applyFilters);
    focalLengthFilter.addEventListener('change', applyFilters);
    compareButton.addEventListener('click', handleCompare);
    resetButton.addEventListener('click', handleReset);

    // 初期データの読み込みと表示
    fetchLensData();
});
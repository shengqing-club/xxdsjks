(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  var tierNames = [
    '黑铁 III', '黑铁 II', '黑铁 I',
    '青铜 III', '青铜 II', '青铜 I',
    '白银 III', '白银 II', '白银 I',
    '黄金 III', '黄金 II', '黄金 I',
    '铂金 III', '铂金 II', '铂金 I',
    '钻石 III', '钻石 II', '钻石 I',
    '王者'
  ];

  var oldThresholds = [0, 5000, 12000, 25000, 45000, 75000, 120000, 180000, 260000, 360000, 480000, 620000, 800000, 1000000, 1250000, 1550000, 1900000, 2300000, 2800000];
  var newThresholds = [0, 2000, 5000, 10000, 20000, 35000, 55000, 80000, 115000, 160000, 215000, 285000, 370000, 470000, 590000, 730000, 900000, 1100000, 1350000];

  // Chart 1: threshold comparison (line)
  var chart1 = echarts.init(document.getElementById('chart-thresholds'), null, { renderer: 'svg' });
  chart1.setOption({
    animation: false,
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      formatter: function(params) {
        var tier = params[0].name;
        var oldVal = params[0].value.toLocaleString();
        var newVal = params[1].value.toLocaleString();
        return tier + '<br/>旧阈值: ' + oldVal + '<br/>新阈值: ' + newVal;
      }
    },
    legend: {
      data: ['旧阈值', '新阈值'],
      bottom: 0,
      textStyle: { color: muted },
      itemWidth: 20, itemHeight: 10
    },
    grid: { left: 80, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: tierNames,
      axisLabel: { rotate: 45, fontSize: 10, color: muted },
      axisLine: { lineStyle: { color: rule } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: function(v) { return (v/1000) + 'k'; }, color: muted, fontSize: 10 },
      splitLine: { lineStyle: { color: rule } }
    },
    series: [
      {
        name: '旧阈值',
        type: 'line',
        data: oldThresholds,
        lineStyle: { color: '#E05555', width: 2 },
        itemStyle: { color: '#E05555' },
        symbol: 'none'
      },
      {
        name: '新阈值',
        type: 'line',
        data: newThresholds,
        lineStyle: { color: accent, width: 2.5 },
        itemStyle: { color: accent },
        symbol: 'none'
      }
    ]
  });
  window.addEventListener('resize', function() { chart1.resize(); });

  // Chart 2: estimated wins per tier
  var avgWinScore = 5000;
  var oldWins = oldThresholds.map(function(v) { return Math.round(v / avgWinScore); });
  var newWins = newThresholds.map(function(v) { return Math.round(v / avgWinScore); });

  var chart2 = echarts.init(document.getElementById('chart-wins'), null, { renderer: 'svg' });
  chart2.setOption({
    animation: false,
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      formatter: function(params) {
        var tier = params[0].name;
        var oldVal = params[0].value;
        var newVal = params[1].value;
        return tier + '<br/>旧方案: ~' + oldVal + ' 胜场<br/>新方案: ~' + newVal + ' 胜场';
      }
    },
    legend: {
      data: ['旧方案胜场', '新方案胜场'],
      bottom: 0,
      textStyle: { color: muted },
      itemWidth: 20, itemHeight: 10
    },
    grid: { left: 80, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: tierNames,
      axisLabel: { rotate: 45, fontSize: 10, color: muted },
      axisLine: { lineStyle: { color: rule } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      name: '累计胜场',
      nameTextStyle: { color: muted, fontSize: 10 },
      axisLabel: { color: muted, fontSize: 10 },
      splitLine: { lineStyle: { color: rule } }
    },
    series: [
      {
        name: '旧方案胜场',
        type: 'bar',
        data: oldWins,
        itemStyle: { color: '#E0555588', borderRadius: [4, 4, 0, 0] },
        barWidth: 12
      },
      {
        name: '新方案胜场',
        type: 'bar',
        data: newWins,
        itemStyle: { color: accent + 'cc', borderRadius: [4, 4, 0, 0] },
        barWidth: 12
      }
    ]
  });
  window.addEventListener('resize', function() { chart2.resize(); });

  // Chart 3: reduction percentage
  var reductions = tierNames.map(function(_, i) {
    if (oldThresholds[i] === 0) return 0;
    return Math.round((1 - newThresholds[i] / oldThresholds[i]) * 100);
  });

  var chart3 = echarts.init(document.getElementById('chart-reduction'), null, { renderer: 'svg' });
  chart3.setOption({
    animation: false,
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      formatter: function(params) {
        return params[0].name + '<br/>门槛降低: ' + params[0].value + '%';
      }
    },
    grid: { left: 80, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: tierNames,
      axisLabel: { rotate: 45, fontSize: 10, color: muted },
      axisLine: { lineStyle: { color: rule } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%', color: muted, fontSize: 10 },
      splitLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'bar',
      data: reductions.map(function(v) {
        return { value: v, itemStyle: { color: v > 50 ? accent2 : accent } };
      }),
      barWidth: 14,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      label: {
        show: true,
        position: 'top',
        formatter: '{c}%',
        fontSize: 9,
        color: muted
      }
    }]
  });
  window.addEventListener('resize', function() { chart3.resize(); });
})();
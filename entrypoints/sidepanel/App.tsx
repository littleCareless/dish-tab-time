import { useState, useEffect, useMemo } from 'react';
import './App.css';
import { DailyTimeStats, DomainTimeStats } from '../../src/types';
import { formatTimeSpent, getDailyTimeStats, getRecentDaysStats } from '../../src/services/timeStats';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';

function App() {
  const [currentDate, setCurrentDate] = useState<string>(() => {
    const now = new Date();
    // 使用本地时区的日期，避免时区问题导致日期慢一天
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  
  const [dailyStats, setDailyStats] = useState<DailyTimeStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'today' | 'week'>('today');
  const [weekStats, setWeekStats] = useState<DailyTimeStats[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedHourlyDate, setSelectedHourlyDate] = useState<string>('');

  // 加载当天的统计数据
  useEffect(() => {
    async function loadDailyStats() {
      setLoading(true);
      try {
        const stats = await getDailyTimeStats(currentDate);
        setDailyStats(stats);
      } catch (error) {
        console.error('加载统计数据失败:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadDailyStats();
    
    // 添加storage监听器实现实时更新
    const handleStorageChange = (changes: Record<string, Browser.storage.StorageChange>) => {
      const dateKey = `tab_time_${currentDate}`;
      if (changes[dateKey]) {
        loadDailyStats();
      }
    };
    
    browser.storage.onChanged.addListener(handleStorageChange);
    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [currentDate]);

  // 加载最近一周的统计数据
  useEffect(() => {
    if (activeTab === 'week') {
      async function loadWeekStats() {
        try {
          const stats = await getRecentDaysStats(7);
          setWeekStats(stats);
        } catch (error) {
          console.error('加载周统计数据失败:', error);
        }
      }
      
      loadWeekStats();
    }
  }, [activeTab]);

  // 处理日期变更
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentDate(e.target.value);
  };

  // 过滤域名统计列表
  const filteredDomainStats = useMemo(() => {
    if (!dailyStats || !searchQuery.trim()) {
      return dailyStats?.domainStats || [];
    }
    
    return dailyStats.domainStats.filter(stat => 
      stat.domain.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [dailyStats, searchQuery]);

  // 渲染域名统计列表
  const renderDomainStats = (domainStats: DomainTimeStats[]) => {
    if (domainStats.length === 0) {
      return searchQuery ? 
        <p className="empty-message">没有找到匹配的网站</p> : 
        <p className="empty-message">今天还没有浏览记录</p>;
    }

    return (
      <div className="domain-stats-list">
        {domainStats.map((stat, index) => (
          <div key={stat.domain} className="domain-stat-item">
            <div className="domain-icon">
              <img 
                src={`https://www.google.com/s2/favicons?domain=${stat.domain}&sz=64`} 
                alt=""
                onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/32')}
              />
            </div>
            <div className="domain-info">
              <div className="domain-name">{stat.domain}</div>
              <div className="domain-visits">{stat.visitCount} 次访问</div>
            </div>
            <div className="domain-time">{formatTimeSpent(stat.totalTimeSpent)}</div>
            <div className="domain-limit">无限制</div>
          </div>
        ))}
      </div>
    );
  };

  // 计算排序后的周统计数据
  const getSortedWeekStats = () => {
    return [...weekStats].sort((a, b) => {
      const dayA = new Date(a.date).getDay(); // 0是周日，1-6是周一到周六
      const dayB = new Date(b.date).getDay();
      // 将周日的0改为7，这样周一到周日的顺序就是1-7
      const adjustedDayA = dayA === 0 ? 7 : dayA;
      const adjustedDayB = dayB === 0 ? 7 : dayB;
      return adjustedDayA - adjustedDayB;
    });
  };

  // 将useEffect移到组件顶层
  useEffect(() => {
    if (selectedHourlyDate === '' && weekStats.length > 0) {
      // 获取今天的日期（本地时区）
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      // 检查今天的日期是否在周统计数据中
      const todayStats = weekStats.find(day => day.date === todayStr);
      
      if (todayStats) {
        // 如果今天的数据存在于周统计中，则默认选择今天
        setSelectedHourlyDate(todayStr);
      } else {
        // 如果今天的数据不存在，则回退到选择排序后的第一天
        const sortedStats = getSortedWeekStats();
        if (sortedStats.length > 0) {
          setSelectedHourlyDate(sortedStats[0]?.date || '');
        }
      }
    }
  }, [weekStats, selectedHourlyDate]);

  // 渲染周统计图表
  const renderWeekChart = () => {
    if (weekStats.length === 0) {
      return <p className="empty-message">加载中...</p>;
    }

    // 按照周一到周日排序
    const sortedWeekStats = getSortedWeekStats();

    // 使用真实的小时统计数据
    const hourlyDistribution = sortedWeekStats.map(day => {
      // 使用每日统计中的小时数据
      const hours = day.hourlyStats ? day.hourlyStats.map(hourStat => ({
        hour: hourStat.hour,
        value: hourStat.timeSpent
      })) : [];
      
      // 如果没有小时数据（旧数据），则使用合理的分布模拟
      if (hours.length === 0) {
        for (let i = 0; i < 24; i++) {
          // 根据一天中的时间段分配使用时间
          let hourFactor = 0;
          if (i >= 8 && i <= 10) hourFactor = 0.08; // 早上
          else if (i >= 11 && i <= 13) hourFactor = 0.12; // 中午
          else if (i >= 14 && i <= 18) hourFactor = 0.15; // 下午
          else if (i >= 19 && i <= 22) hourFactor = 0.10; // 晚上
          else hourFactor = 0.01; // 深夜和凌晨
          
          // 计算该小时的使用时间，基于当天总时间和时间因子
          const hourValue = day.totalTimeSpent * hourFactor;
          hours.push({
            hour: i,
            value: hourValue
          });
        }
      }
      
      return { date: day.date, hours };
    });

    // 找到选中日期的数据
    const selectedDayData = hourlyDistribution.find(d => d.date === selectedHourlyDate);
    
    // 周统计图表配置
    const weekChartOption = {
      tooltip: {
        trigger: 'axis',
        formatter: function(params: any) {
          const dayData = sortedWeekStats[params[0].dataIndex];
          const dayName = new Date(dayData.date).toLocaleDateString('zh-CN', { weekday: 'long' });
          return `${dayName}<br/>使用时间: ${formatTimeSpent(dayData.totalTimeSpent)}`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: sortedWeekStats.map(day => new Date(day.date).toLocaleDateString('zh-CN', { weekday: 'short' })),
        axisLine: {
          lineStyle: {
            color: '#ddd'
          }
        },
        axisLabel: {
          color: '#666'
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: function(value: number) {
            return formatTimeSpent(value).replace('小时', 'h').replace('分钟', 'm');
          },
          color: '#666'
        },
        splitLine: {
          lineStyle: {
            color: '#eee'
          }
        }
      },
      series: [{
        name: '使用时间',
        type: 'bar',
        data: sortedWeekStats.map(day => ({
          value: day.totalTimeSpent,
          itemStyle: {
            color: day.date === selectedHourlyDate ? '#4285f4' : 
                  (day.date === new Date().toISOString().split('T')[0] ? '#34a853' : '#5f6368')
          }
        })),
        barWidth: '50%',
        emphasis: {
          itemStyle: {
            color: '#4285f4',
            shadowBlur: 10,
            shadowColor: 'rgba(66, 133, 244, 0.5)'
          }
        }
      }]
    };
    
    // 小时分布图表配置
    const hourlyChartOption = {
      tooltip: {
        trigger: 'axis',
        formatter: function(params: any) {
          const hour = params[0].name;
          const value = params[0].value;
          return `${hour}<br/>使用时间: ${formatTimeSpent(value)}`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: selectedDayData?.hours.map(h => `${h.hour}时`) || [],
        axisLabel: {
          interval: 2,
          color: '#666'
        },
        axisLine: {
          lineStyle: {
            color: '#ddd'
          }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: function(value: number) {
            return formatTimeSpent(value).replace('小时', 'h').replace('分钟', 'm');
          },
          color: '#666'
        },
        splitLine: {
          lineStyle: {
            color: '#eee'
          }
        }
      },
      series: [{
        name: '使用时间',
        type: 'bar',
        data: selectedDayData?.hours.map(h => ({
          value: h.value,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#4285f4' },
                { offset: 1, color: '#34a853' }
              ]
            }
          }
        })) || [],
        barWidth: '60%',
        emphasis: {
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#5e97f6' },
                { offset: 1, color: '#4fc3f7' }
              ]
            }
          }
        }
      }]
    };
    
    return (
      <div className="stats-charts">
        <div className="week-chart-container">
          <ReactECharts 
            option={weekChartOption} 
            style={{ height: '250px', width: '100%' }} 
            onEvents={{
              'click': (params: any) => {
                if (params.dataIndex !== undefined && sortedWeekStats[params.dataIndex]) {
                  setSelectedHourlyDate(sortedWeekStats[params.dataIndex].date);
                }
              }
            }}
          />
        </div>
        
        <div className="hourly-chart-title">
          {selectedHourlyDate && (
            <h3>
              {new Date(selectedHourlyDate).toLocaleDateString('zh-CN', { weekday: 'long' })}时间分布
            </h3>
          )}
        </div>
        
        <div className="hourly-chart-container">
          <ReactECharts 
            option={hourlyChartOption} 
            style={{ height: '200px', width: '100%' }} 
          />
        </div>
      </div>
    );
  };

  // 处理前一天和后一天导航
  const goToPreviousDay = () => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - 1);
    setCurrentDate(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + 1);
    
    // 获取今天的日期（本地时区）
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // 获取下一天的日期字符串（本地时区）
    const nextDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // 不允许选择未来日期
    if (nextDateStr <= todayStr) {
      setCurrentDate(nextDateStr);
    }
  };

  // 格式化当前日期显示
  const formattedDate = () => {
    const date = new Date(currentDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // 获取今天的日期（本地时区）
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = currentDate === todayStr;
    
    return `${month}月${day}日 ${isToday ? '今天' : ''}`;
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>
          使用时间
          <span>{dailyStats ? formatTimeSpent(dailyStats.totalTimeSpent) : '0小时0分钟'}</span>
        </h1>
        <div className="date-navigation">
          <button onClick={goToPreviousDay}>&lt;</button>
          <div className="current-date">{formattedDate()}</div>
          <button onClick={goToNextDay}>&gt;</button>
        </div>
        <div className="tab-selector">
          <button 
            className={`tab-button ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveTab('today')}
          >
            今日统计
          </button>
          <button 
            className={`tab-button ${activeTab === 'week' ? 'active' : ''}`}
            onClick={() => setActiveTab('week')}
          >
            本周统计
          </button>
        </div>
      </header>

      <main className="app-content">
        {activeTab === 'today' ? (
          <div className="today-stats">
            <div className="date-selector">
              <input 
                type="date" 
                value={currentDate} 
                onChange={handleDateChange} 
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            {loading ? (
              <p className="loading">加载中...</p>
            ) : (
              <>
                <div className="domain-stats">
                  <div className="domain-stats-header">
                    <div className="domain-header-top">
                      <h2>显示 网站</h2>
                      <div className="search-container">
                        <input
                          type="text"
                          placeholder="搜索..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="search-input"
                        />
                        {searchQuery && (
                          <button 
                            className="clear-search" 
                            onClick={() => setSearchQuery('')}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="domain-header-columns">
                      <div className="column-app">网站</div>
                      <div className="column-time">时间</div>
                      <div className="column-limit">限额</div>
                    </div>
                  </div>
                  {dailyStats ? renderDomainStats(filteredDomainStats) : null}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="week-stats">
            <h2>最近7天使用趋势</h2>
            {renderWeekChart()}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

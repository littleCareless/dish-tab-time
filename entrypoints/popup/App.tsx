import { useState, useEffect } from 'react';
import './App.css';
import { DailyTimeStats, DomainTimeStats } from '../../src/types';
import { formatTimeSpent, getDailyTimeStats, getRecentDaysStats } from '../../src/services/timeStats';

function App() {
  const [currentDate, setCurrentDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  
  const [dailyStats, setDailyStats] = useState<DailyTimeStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'today' | 'week'>('today');
  const [weekStats, setWeekStats] = useState<DailyTimeStats[]>([]);

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

  // 渲染域名统计列表
  const renderDomainStats = (domainStats: DomainTimeStats[]) => {
    if (domainStats.length === 0) {
      return <p className="empty-message">今天还没有浏览记录</p>;
    }

    return (
      <div className="domain-stats-list">
        {domainStats.map((stat, index) => (
          <div key={stat.domain} className="domain-stat-item">
            <div className="domain-rank">{index + 1}</div>
            <div className="domain-info">
              <div className="domain-name">{stat.domain}</div>
              <div className="domain-time">{formatTimeSpent(stat.totalTimeSpent)}</div>
              <div className="domain-visits">{stat.visitCount} 次访问</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 渲染周统计图表
  const renderWeekChart = () => {
    if (weekStats.length === 0) {
      return <p className="empty-message">加载中...</p>;
    }

    // 找出最大使用时间，用于计算比例
    const maxTime = Math.max(...weekStats.map(day => day.totalTimeSpent));
    
    return (
      <div className="week-chart">
        {weekStats.map(day => {
          const dayName = new Date(day.date).toLocaleDateString('zh-CN', { weekday: 'short' });
          const percentage = maxTime > 0 ? (day.totalTimeSpent / maxTime) * 100 : 0;
          
          return (
            <div key={day.date} className="day-stat">
              <div className="day-name">{dayName}</div>
              <div className="day-bar-container">
                <div 
                  className="day-bar" 
                  style={{ height: `${percentage}%` }}
                  title={formatTimeSpent(day.totalTimeSpent)}
                ></div>
              </div>
              <div className="day-time">{formatTimeSpent(day.totalTimeSpent)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>浏览时间统计</h1>
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
                <div className="total-time">
                  <h2>总浏览时间</h2>
                  <div className="time-value">{dailyStats ? formatTimeSpent(dailyStats.totalTimeSpent) : '0秒'}</div>
                </div>
                
                <div className="domain-stats">
                  <h2>网站使用时间排行</h2>
                  {dailyStats ? renderDomainStats(dailyStats.domainStats) : null}
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

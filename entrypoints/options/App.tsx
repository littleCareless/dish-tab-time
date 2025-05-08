import { useState, useEffect } from 'react';
import { WebsiteLimitConfig } from '../../src/types';
import { getWebsiteLimits, saveWebsiteLimits, formatTimeLimit, timeToMilliseconds } from '../../src/settings/website-limits';

function App() {
  // 当前选中的标签页
  const [activeTab, setActiveTab] = useState<string>('website-limits');
  // 网站限制配置列表
  const [websiteLimits, setWebsiteLimits] = useState<WebsiteLimitConfig[]>([]);
  // 是否正在加载数据
  const [loading, setLoading] = useState<boolean>(true);
  // 是否正在编辑某个配置
  const [editingLimit, setEditingLimit] = useState<WebsiteLimitConfig | null>(null);
  // 新增或编辑的表单数据
  const [formData, setFormData] = useState<{
    domain: string;
    matchPattern: string;
    dailyLimit: number;
    workdayLimit?: number;
    weekendLimit?: number;
    enabled: boolean;
  }>({ domain: '', matchPattern: '', dailyLimit: 60 * 60 * 1000, enabled: true });
  // 表单显示的小时和分钟
  const [timeInputs, setTimeInputs] = useState<{
    dailyHours: number;
    dailyMinutes: number;
    workdayHours: number;
    workdayMinutes: number;
    weekendHours: number;
    weekendMinutes: number;
  }>({ 
    dailyHours: 1, 
    dailyMinutes: 0,
    workdayHours: 0,
    workdayMinutes: 0,
    weekendHours: 0,
    weekendMinutes: 0
  });

  // 加载网站限制配置
  useEffect(() => {
    async function loadWebsiteLimits() {
      setLoading(true);
      try {
        const limits = await getWebsiteLimits();
        setWebsiteLimits(limits);
      } catch (error) {
        console.error('加载网站限制配置失败:', error);
      } finally {
        setLoading(false);
      }
    }

    loadWebsiteLimits();
  }, []);

  /**
   * 处理表单输入变化
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  /**
   * 处理时间输入变化
   */
  const handleTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value) || 0;
    
    setTimeInputs(prev => ({ ...prev, [name]: numValue }));
    
    // 更新对应的毫秒值
    if (name === 'dailyHours' || name === 'dailyMinutes') {
      const hours = name === 'dailyHours' ? numValue : timeInputs.dailyHours;
      const minutes = name === 'dailyMinutes' ? numValue : timeInputs.dailyMinutes;
      setFormData(prev => ({ ...prev, dailyLimit: timeToMilliseconds(hours, minutes) }));
    } else if (name === 'workdayHours' || name === 'workdayMinutes') {
      const hours = name === 'workdayHours' ? numValue : timeInputs.workdayHours;
      const minutes = name === 'workdayMinutes' ? numValue : timeInputs.workdayMinutes;
      setFormData(prev => ({ ...prev, workdayLimit: timeToMilliseconds(hours, minutes) }));
    } else if (name === 'weekendHours' || name === 'weekendMinutes') {
      const hours = name === 'weekendHours' ? numValue : timeInputs.weekendHours;
      const minutes = name === 'weekendMinutes' ? numValue : timeInputs.weekendMinutes;
      setFormData(prev => ({ ...prev, weekendLimit: timeToMilliseconds(hours, minutes) }));
    }
  };

  /**
   * 添加或更新网站限制配置
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.domain) {
      alert('请输入网站域名');
      return;
    }
    
    try {
      // 创建新的限制配置列表
      let newLimits: WebsiteLimitConfig[];
      
      if (editingLimit) {
        // 更新现有配置
        newLimits = websiteLimits.map(limit => 
          limit.domain === editingLimit.domain ? { ...limit, ...formData } : limit
        );
      } else {
        // 添加新配置
        newLimits = [...websiteLimits, formData as WebsiteLimitConfig];
      }
      
      // 保存到存储
      await saveWebsiteLimits(newLimits);
      setWebsiteLimits(newLimits);
      
      // 重置表单
      resetForm();
    } catch (error) {
      console.error('保存网站限制配置失败:', error);
      alert('保存失败，请重试');
    }
  };

  /**
   * 编辑网站限制配置
   */
  const handleEdit = (limit: WebsiteLimitConfig) => {
    setEditingLimit(limit);
    
    // 设置表单数据
    setFormData({
      domain: limit.domain,
      matchPattern: limit.matchPattern || '',
      dailyLimit: limit.dailyLimit,
      workdayLimit: limit.workdayLimit,
      weekendLimit: limit.weekendLimit,
      enabled: limit.enabled
    });
    
    // 设置时间输入
    const dailyHours = Math.floor(limit.dailyLimit / (1000 * 60 * 60));
    const dailyMinutes = Math.floor((limit.dailyLimit % (1000 * 60 * 60)) / (1000 * 60));
    
    const workdayHours = limit.workdayLimit 
      ? Math.floor(limit.workdayLimit / (1000 * 60 * 60))
      : 0;
    const workdayMinutes = limit.workdayLimit 
      ? Math.floor((limit.workdayLimit % (1000 * 60 * 60)) / (1000 * 60))
      : 0;
    
    const weekendHours = limit.weekendLimit 
      ? Math.floor(limit.weekendLimit / (1000 * 60 * 60))
      : 0;
    const weekendMinutes = limit.weekendLimit 
      ? Math.floor((limit.weekendLimit % (1000 * 60 * 60)) / (1000 * 60))
      : 0;
    
    setTimeInputs({
      dailyHours,
      dailyMinutes,
      workdayHours,
      workdayMinutes,
      weekendHours,
      weekendMinutes
    });
  };

  /**
   * 删除网站限制配置
   */
  const handleDelete = async (domain: string) => {
    if (!confirm(`确定要删除 ${domain} 的使用限制吗？`)) {
      return;
    }
    
    try {
      const newLimits = websiteLimits.filter(limit => limit.domain !== domain);
      await saveWebsiteLimits(newLimits);
      setWebsiteLimits(newLimits);
    } catch (error) {
      console.error('删除网站限制配置失败:', error);
      alert('删除失败，请重试');
    }
  };

  /**
   * 切换网站限制启用状态
   */
  const handleToggleEnabled = async (domain: string, enabled: boolean) => {
    try {
      const newLimits = websiteLimits.map(limit => 
        limit.domain === domain ? { ...limit, enabled } : limit
      );
      await saveWebsiteLimits(newLimits);
      setWebsiteLimits(newLimits);
    } catch (error) {
      console.error('更新网站限制状态失败:', error);
      alert('更新失败，请重试');
    }
  };

  /**
   * 重置表单
   */
  const resetForm = () => {
    setEditingLimit(null);
    setFormData({ domain: '', matchPattern: '', dailyLimit: 60 * 60 * 1000, enabled: true });
    setTimeInputs({ 
      dailyHours: 1, 
      dailyMinutes: 0,
      workdayHours: 0,
      workdayMinutes: 0,
      weekendHours: 0,
      weekendMinutes: 0
    });
  };

  /**
   * 渲染标签页导航
   */
  const renderTabs = () => {
    const tabs = [
      { id: 'website-limits', name: '网站限制' },
      // 未来可以添加更多标签页
      { id: 'general', name: '常规设置' },
      { id: 'about', name: '关于' }
    ];
    
    return (
      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.name}
          </button>
        ))}
      </div>
    );
  };

  /**
   * 渲染网站限制设置表单
   */
  const renderLimitForm = () => {
    return (
      <form className="limit-form" onSubmit={handleSubmit}>
        <h3>{editingLimit ? '编辑网站限制' : '添加网站限制'}</h3>
        
        <div className="form-group">
          <label htmlFor="domain">网站域名:</label>
          <input
            type="text"
            id="domain"
            name="domain"
            value={formData.domain}
            onChange={handleInputChange}
            placeholder="例如: example.com"
            disabled={!!editingLimit}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="matchPattern">匹配模式:</label>
          <input
            type="text"
            id="matchPattern"
            name="matchPattern"
            value={formData.matchPattern}
            onChange={handleInputChange}
            placeholder="例如: *.example.com 或 *example*"
          />
          <p className="form-hint">
            支持通配符(*): *.example.com 匹配所有子域名<br/>
            正则表达式: /pattern/ 格式<br/>
            留空则精确匹配域名
          </p>
        </div>
        
        <div className="form-group">
          <label>每日使用时间限制:</label>
          <div className="time-inputs">
            <input
              type="number"
              name="dailyHours"
              value={timeInputs.dailyHours}
              onChange={handleTimeInputChange}
              min="0"
              max="24"
            />
            <span>小时</span>
            <input
              type="number"
              name="dailyMinutes"
              value={timeInputs.dailyMinutes}
              onChange={handleTimeInputChange}
              min="0"
              max="59"
            />
            <span>分钟</span>
          </div>
          <p className="form-hint">设置为0时将完全阻止访问</p>
        </div>
        
        <div className="form-group">
          <label>工作日限制 (周一至周五):</label>
          <div className="time-inputs">
            <input
              type="number"
              name="workdayHours"
              value={timeInputs.workdayHours}
              onChange={handleTimeInputChange}
              min="0"
              max="24"
            />
            <span>小时</span>
            <input
              type="number"
              name="workdayMinutes"
              value={timeInputs.workdayMinutes}
              onChange={handleTimeInputChange}
              min="0"
              max="59"
            />
            <span>分钟</span>
          </div>
          <p className="form-hint">留空则使用每日限制</p>
        </div>
        
        <div className="form-group">
          <label>周末限制 (周六和周日):</label>
          <div className="time-inputs">
            <input
              type="number"
              name="weekendHours"
              value={timeInputs.weekendHours}
              onChange={handleTimeInputChange}
              min="0"
              max="24"
            />
            <span>小时</span>
            <input
              type="number"
              name="weekendMinutes"
              value={timeInputs.weekendMinutes}
              onChange={handleTimeInputChange}
              min="0"
              max="59"
            />
            <span>分钟</span>
          </div>
          <p className="form-hint">留空则使用每日限制</p>
        </div>
        
        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              name="enabled"
              checked={formData.enabled}
              onChange={handleInputChange}
            />
            启用限制
          </label>
        </div>
        
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {editingLimit ? '保存修改' : '添加限制'}
          </button>
          {editingLimit && (
            <button type="button" className="btn-secondary" onClick={resetForm}>
              取消
            </button>
          )}
        </div>
      </form>
    );
  };

  /**
   * 渲染网站限制列表
   */
  const renderLimitsList = () => {
    if (loading) {
      return <p className="loading">加载中...</p>;
    }
    
    if (websiteLimits.length === 0) {
      return <p className="empty-message">暂无网站限制配置</p>;
    }
    
    return (
      <div className="limits-list">
        {websiteLimits.map(limit => (
          <div key={limit.domain} className="limit-item">
            <div className="limit-domain">
              {limit.domain}
              {limit.matchPattern && (
                <div className="limit-pattern">匹配模式: {limit.matchPattern}</div>
              )}
            </div>
            <div className="limit-details">
              <div className="limit-time">
                <span className="limit-label">每日限制:</span> 
                <span className="limit-value">{formatTimeLimit(limit.dailyLimit)}</span>
              </div>
              {limit.workdayLimit && (
                <div className="limit-time">
                  <span className="limit-label">工作日:</span> 
                  <span className="limit-value">{formatTimeLimit(limit.workdayLimit)}</span>
                </div>
              )}
              {limit.weekendLimit && (
                <div className="limit-time">
                  <span className="limit-label">周末:</span> 
                  <span className="limit-value">{formatTimeLimit(limit.weekendLimit)}</span>
                </div>
              )}
            </div>
            <div className="limit-status">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={limit.enabled}
                  onChange={(e) => handleToggleEnabled(limit.domain, e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="limit-actions">
              <button 
                className="btn-edit" 
                onClick={() => handleEdit(limit)}
                title="编辑"
              >
                ✏️
              </button>
              <button 
                className="btn-delete" 
                onClick={() => handleDelete(limit.domain)}
                title="删除"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * 渲染网站限制标签页内容
   */
  const renderWebsiteLimitsTab = () => {
    return (
      <div className="website-limits-tab">
        <div className="tab-header">
          <h2>网站使用时间限制</h2>
          <p className="tab-description">
            设置网站的每日使用时间限制，超过限制时将阻止访问。可以为工作日和周末设置不同的限制。
          </p>
        </div>
        
        <div className="tab-content">
          <div className="limits-container">
            <h3>已设置的限制</h3>
            {renderLimitsList()}
          </div>
          
          <div className="form-container">
            {renderLimitForm()}
          </div>
        </div>
      </div>
    );
  };

  /**
   * 渲染常规设置标签页内容（占位）
   */
  const renderGeneralTab = () => {
    return (
      <div className="general-tab">
        <h2>常规设置</h2>
        <p>此功能正在开发中...</p>
      </div>
    );
  };

  /**
   * 渲染关于标签页内容（占位）
   */
  const renderAboutTab = () => {
    return (
      <div className="about-tab">
        <h2>关于</h2>
        <p>浏览时间追踪扩展</p>
        <p>版本: 1.0.0</p>
      </div>
    );
  };

  /**
   * 根据当前选中的标签页渲染内容
   */
  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'website-limits':
        return renderWebsiteLimitsTab();
      case 'general':
        return renderGeneralTab();
      case 'about':
        return renderAboutTab();
      default:
        return renderWebsiteLimitsTab();
    }
  };

  return (
    <div className="options-container">
      {renderTabs()}
      <div className="tab-content-container">
        {renderActiveTabContent()}
      </div>
    </div>
  );
}

export default App;
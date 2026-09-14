import { Outlet, NavLink } from 'react-router-dom'
import { Layout, Menu, Typography } from 'antd'
import { DashboardOutlined, ShoppingOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout

const AppLayout = () => (
  <Layout style={{ minHeight: '100vh' }}>
    <Sider breakpoint="lg" collapsedWidth={64}>
      <div style={{ color: '#fff', padding: 16, fontWeight: 700 }}>SGMS</div>
      <Menu
        theme="dark"
        mode="inline"
        defaultSelectedKeys={['dashboard']}
        items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: <NavLink to="/dashboard">Dashboard</NavLink> },
          { key: 'products', icon: <ShoppingOutlined />, label: <NavLink to="/products">San pham</NavLink> },
        ]}
      />
    </Sider>
    <Layout>
      <Header style={{ background: '#fff', padding: '0 24px' }}>
        <Typography.Text strong>Smart Grocery Management</Typography.Text>
      </Header>
      <Content style={{ margin: 24 }}>
        <Outlet />
      </Content>
    </Layout>
  </Layout>
)

export default AppLayout
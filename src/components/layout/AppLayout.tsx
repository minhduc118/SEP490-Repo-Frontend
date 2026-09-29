import { Outlet, NavLink } from 'react-router-dom'
import { Layout, Menu, Typography } from 'antd'
import { DashboardOutlined, ShoppingOutlined, ThunderboltOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = Layout

const AppLayout = () => (
  <Layout className="min-h-screen">
    <Sider breakpoint="lg" collapsedWidth={64}>
      <div className="p-4 font-bold text-white">SGMS</div>
      <Menu
        theme="dark"
        mode="inline"
        defaultSelectedKeys={['dashboard']}
        items={[
          { key: 'dashboard', icon: <DashboardOutlined />, label: <NavLink to="/dashboard">Dashboard</NavLink> },
          { key: 'products', icon: <ShoppingOutlined />, label: <NavLink to="/products">San pham</NavLink> },
          { key: 'teamspec', icon: <ThunderboltOutlined />, label: <NavLink to="/teamspec">TeamSpec Monitor</NavLink> },
        ]}
      />
    </Sider>
    <Layout>
      <Header className="!bg-white !px-6">
        <Typography.Text strong>Smart Grocery Management</Typography.Text>
      </Header>
      <Content className="m-6">
        <Outlet />
      </Content>
    </Layout>
  </Layout>
)

export default AppLayout

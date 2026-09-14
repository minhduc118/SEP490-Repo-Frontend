import { Button, Card, Form, Input, Typography } from 'antd'

const LoginPage = () => (
  <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f5f5' }}>
    <Card style={{ width: 360 }}>
      <Typography.Title level={3}>SGMS Login</Typography.Title>
      <Form layout="vertical">
        <Form.Item label="Email" name="email" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Password" name="password" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>
          Login
        </Button>
      </Form>
    </Card>
  </div>
)

export default LoginPage
import { Button, Card, Form, Input, Typography } from 'antd'

const LoginPage = () => (
  <div className="grid min-h-screen place-items-center bg-neutral-100">
    <Card className="w-[360px]">
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

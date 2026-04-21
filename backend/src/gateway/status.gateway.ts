import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class StatusGateway {
  @WebSocketServer() server: any;
  private readonly logger = new Logger(StatusGateway.name);

  constructor(private readonly db: DatabaseService) {}

  async afterInit() {
    this.logger.log('WebSocket Gateway initialized');
    await this.setupPgListen();
  }

  handleConnection(client: any) {
    this.logger.log(`Client connected: ${client?.id}`);
  }

  handleDisconnect(client: any) {
    this.logger.log(`Client disconnected: ${client?.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: any, @MessageBody() data: { country: string }) {
    if (data.country) {
      client.join(`country:${data.country}`);
      this.logger.log(`Client ${client.id} joined room: country:${data.country}`);
      return { event: 'joined', data: `Joined country:${data.country}` };
    }
  }

  private async setupPgListen() {
    try {
      const client = await this.db.getClient();
      await client.query('LISTEN status_channel');
      
      client.on('notification', (msg) => {
        if (msg.channel === 'status_channel') {
          const payload = JSON.parse(msg.payload);
          this.logger.log(`Received pg_notify on status_channel: ${JSON.stringify(payload)}`);
          if (payload.country && this.server) {
             this.server.to(`country:${payload.country}`).emit('status:changed', payload);
          }
        }
      });
      this.logger.log('Listening to pg_notify "status_channel"');
    } catch (e) {
      this.logger.error('Failed to setup pg_notify listener', e);
    }
  }
}

import { Global, Module, OnModuleInit, Inject } from '@nestjs/common';
import { ReadDbSyncService } from './services/read-db-sync.service';
import { LoggerService } from './services/logger.service';
import { KafkaBridgeService } from './services/kafka-bridge.service';
import { ClientsModule, Transport, ClientKafka } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Partitioners } from 'kafkajs';

@Global()
@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'SECURITY_KAFKA_CLIENT',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'security-producer',
                brokers: [configService.get<string>('URL_BROKER') || '127.0.0.1:9092'],
                connectionTimeout: Number(configService.get('KAFKA_CONNECTION_TIMEOUT') || 5000),
                requestTimeout: Number(configService.get('KAFKA_REQUEST_TIMEOUT') || 30000),
                retry: {
                  retries: Number(configService.get('KAFKA_RETRIES') || 10),
                  initialRetryTime: Number(configService.get('KAFKA_INITIAL_RETRY_TIME') || 300),
                  maxRetryTime: Number(configService.get('KAFKA_MAX_RETRY_TIME') || 30000),
                },
                sasl: {
                  mechanism: 'plain',
                  username: configService.get<string>('KFUSERNAME') || 'admin',
                  password: configService.get<string>('KFPASSWORD') || 'admin-secret',
                },
              },
              consumer: {
                groupId: `${configService.get<string>('GROUP_ID_KAFKA') || 'ms-template'}-bridge-group` +
                  (configService.get('NODE_ENV') === 'development' ? `-${Math.random().toString(36).substring(2, 9)}` : ''),
                sessionTimeout: Number(configService.get('KAFKA_SESSION_TIMEOUT') || 45000),
                heartbeatInterval: Number(configService.get('KAFKA_HEARTBEAT_INTERVAL') || 15000),
                rebalanceTimeout: Number(configService.get('KAFKA_REBALANCE_TIMEOUT') || 60000),
                maxBytesPerPartition: Number(configService.get('KAFKA_MAX_BYTES_PER_PARTITION') || 1048576),
                maxBytes: Number(configService.get('KAFKA_MAX_BYTES') || 5242880),
              },
              producer: {
                createPartitioner: Partitioners.LegacyPartitioner,
              },
            },
          };
        },
      },
    ]),
  ],
  providers: [
    ReadDbSyncService,
    LoggerService,
    KafkaBridgeService,
  ],
  exports: [
    ReadDbSyncService,
    LoggerService,
    KafkaBridgeService,
    ClientsModule,
  ],
})
export class CommonModule implements OnModuleInit {
  constructor(
    @Inject('SECURITY_KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit() {
    const topics = [
      // TODO: aqui irán los topicos para suscribirse
    ];

    topics.forEach((topic) => {
      this.kafkaClient.subscribeToResponseOf(topic);
    });

    this.kafkaClient.connect()
      .then(() => {
        this.logger.log('Security Kafka client connected and topics subscribed');
      })
      .catch((error) => {
        this.logger.error('Failed to connect to Kafka:', error);
      });
  }
}

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as fs from 'fs';

@Injectable()
export class CleanUploadedFilesInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err) => {
        const req = context.switchToHttp().getRequest();
        if (req.files) {
          const filesObj = req.files as Record<string, Express.Multer.File[]>;
          for (const key in filesObj) {
            const files = filesObj[key];
            for (const file of files) {
              if (file.path && fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
              }
            }
          }
        } else if (req.file) {
          const file = req.file as Express.Multer.File;
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
        return throwError(() => err);
      }),
    );
  }
}

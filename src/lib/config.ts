import yaml from 'js-yaml';
import fs from 'fs';
import { ConfigSchema } from '../types/types';
import { exit } from 'process';

export function getConfig() {
    try {
        const file = yaml.load(fs.readFileSync('./config/config.yml', 'utf8'));
        return ConfigSchema.parse(file);
    } catch (error) {
        console.log(error);
        exit(1);
    }
}